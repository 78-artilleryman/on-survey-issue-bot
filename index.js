require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const axios = require("axios");
const express = require("express");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_KEY = process.env.LINEAR_TEAM_KEY; // 선택, 예: ON/ENG 같은 팀 키

if (!DISCORD_TOKEN || !LINEAR_API_KEY) {
  console.error("환경 변수 누락: DISCORD_TOKEN, LINEAR_API_KEY 필요");
  process.exit(1);
}

// Express 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Linear GraphQL 요청 유틸
const linearGraphQL = async (query, variables) => {
  const url = "https://api.linear.app/graphql";
  const headers = {
    "Content-Type": "application/json",
    Authorization: LINEAR_API_KEY,
  };
  const body = { query, variables };
  try {
    const { data } = await axios.post(url, body, { headers });
    if (data.errors) {
      const message = data.errors.map((e) => e.message).join("; ");
      throw new Error(message);
    }
    return data.data;
  } catch (err) {
    if (err.response && err.response.data) {
      const gqlErrors = err.response.data.errors;
      if (Array.isArray(gqlErrors) && gqlErrors.length) {
        const message = gqlErrors.map((e) => e.message).join("; ");
        throw new Error(message);
      }
      throw new Error(
        `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      );
    }
    throw err;
  }
};

// 팀 키 기반/자동 팀 선택
let RESOLVED_TEAM_ID = null;
async function resolveTeamId() {
  if (RESOLVED_TEAM_ID) return RESOLVED_TEAM_ID;
  const query = `
    query AllTeams { teams { nodes { id name key } } }
  `;
  const data = await linearGraphQL(query, {});
  const teams = data?.teams?.nodes || [];
  if (!teams.length)
    throw new Error("사용 가능한 Linear 팀을 찾지 못했습니다.");
  if (LINEAR_TEAM_KEY) {
    const byKey = teams.find(
      (t) =>
        t.key && t.key.toLowerCase() === String(LINEAR_TEAM_KEY).toLowerCase()
    );
    if (byKey) {
      RESOLVED_TEAM_ID = byKey.id;
      return RESOLVED_TEAM_ID;
    }
    // 키가 지정됐지만 매칭 안 되면 첫 번째 팀 사용
  }
  RESOLVED_TEAM_ID = teams[0].id;
  return RESOLVED_TEAM_ID;
}

// 이름으로 Linear 사용자 검색 (간단 부분일치)
async function findLinearUserIdByName(name) {
  // 서버 필터 대신 모든 사용자 목록을 받아 클라이언트에서 매칭해 400 이슈 회피
  const query = `
    query AllUsers {
      users { nodes { id name email } }
    }
  `;
  const data = await linearGraphQL(query, {});
  const users = data?.users?.nodes || [];
  const lower = name.toLowerCase();
  const exact = users.find((u) => (u.name || "").toLowerCase() === lower);
  if (exact) return exact.id || null;
  const partial = users.find((u) =>
    (u.name || "").toLowerCase().includes(lower)
  );
  return partial?.id || null;
}

// 이슈 생성
async function createLinearIssue({ title, description, assigneeId, teamId }) {
  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url assignee { id name } }
      }
    }
  `;
  const resolvedTeamId = teamId || (await resolveTeamId());
  const input = {
    title,
    description: description || "",
    teamId: resolvedTeamId,
    assigneeId: assigneeId || undefined,
  };
  const data = await linearGraphQL(mutation, { input });
  const result = data?.issueCreate;
  if (!result?.success) throw new Error("Linear 이슈 생성 실패");
  return result.issue;
}

function parseCreateIssueCommand(content) {
  // 패턴: !이슈생성 타이틀-이름 (괄호 없음)
  const trimmed = content.trim();
  const prefix = "!이슈생성";
  if (!trimmed.startsWith(prefix)) return null;
  const raw = trimmed.slice(prefix.length).trim();
  // 괄호는 지원하지 않음. 그대로 사용
  const cleaned = raw;
  // 마지막 하이픈으로 분리: 제목에 하이픈이 들어갈 수도 있으므로
  const lastHyphen = cleaned.lastIndexOf("-");
  if (lastHyphen === -1) return null;
  const title = cleaned.slice(0, lastHyphen).trim();
  const name = cleaned.slice(lastHyphen + 1).trim();
  if (!title || !name) return null;
  return { title, name };
}

// ClientReady 이벤트는 startServer() 함수에서 처리

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    const parsed = parseCreateIssueCommand(message.content);
    if (!parsed) return;

    // 쓰레드에서 온 메시지면 먼저 쓰레드에 조인 (권한/가시성 이슈 방지)
    if (
      message.channel &&
      typeof message.channel.isThread === "function" &&
      message.channel.isThread()
    ) {
      const thread = message.channel;
      if (thread.joinable && !thread.joined) {
        try {
          await thread.join();
        } catch (_) {}
      }
    }

    await message.channel.send("이슈 생성 중입니다...");

    const { title, name } = parsed;
    const assigneeId = await findLinearUserIdByName(name);

    if (!assigneeId) {
      await message.channel.send(
        `담당자 '${name}'을(를) 찾지 못해, 미배정으로 이슈를 생성합니다.`
      );
    }

    const isThread =
      message.channel &&
      typeof message.channel.isThread === "function" &&
      message.channel.isThread();
    const contextUrl = isThread
      ? message.channel.url || message.url
      : message.url;
    const baseDesc = `디스코드에서 @${message.author.username} 님이 생성`;
    const desc = `${baseDesc}\n디스코드 URL: ${contextUrl}`;

    const issue = await createLinearIssue({
      title,
      description: desc,
      assigneeId,
    });

    await message.channel.send(
      `이슈가 생성되었습니다: ${issue.identifier} ${issue.url}`
    );
  } catch (err) {
    console.error(err);
    await message.channel.send(
      `이슈 생성 중 오류가 발생했습니다: ${err.message}`
    );
  }
});

// Health check 엔드포인트
app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    botStatus: client.isReady() ? "online" : "offline",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    message: "Discord Issue Bot is running!",
  });
});

// Health check for external ping services
app.get("/health", (req, res) => {
  const isBotReady = client.isReady();
  if (isBotReady) {
    res.status(200).json({
      status: "healthy",
      bot: "online",
      uptime: Math.floor(process.uptime()),
    });
  } else {
    res.status(503).json({
      status: "degraded",
      bot: "offline",
      message: "Discord bot is not ready",
    });
  }
});

// Render Keep-Alive를 위한 추가 엔드포인트
app.get("/ping", (req, res) => {
  res.status(200).json({
    message: "pong",
    timestamp: new Date().toISOString(),
    botStatus: client.isReady() ? "online" : "offline",
  });
});

// Keep-Alive를 위한 주기적 ping (5분마다)
setInterval(() => {
  console.log("🔄 Keep-Alive ping:", new Date().toISOString());
}, 5 * 60 * 1000);

// API 엔드포인트 (선택사항 - Linear 이슈 생성용)
app.post("/api/create-issue", async (req, res) => {
  try {
    const { title, assigneeName, description, discordUser, discordUrl } =
      req.body;

    if (!title || !assigneeName) {
      return res.status(400).json({
        error: "title과 assigneeName은 필수입니다.",
      });
    }

    // 담당자 ID 찾기
    const assigneeId = await findLinearUserIdByName(assigneeName);

    // 이슈 설명 생성
    const baseDesc =
      description || `Discord에서 ${discordUser || "사용자"} 님이 생성`;
    const fullDesc = discordUrl
      ? `${baseDesc}\nDiscord URL: ${discordUrl}`
      : baseDesc;

    // 이슈 생성
    const issue = await createLinearIssue({
      title,
      description: fullDesc,
      assigneeId,
    });

    res.json({
      success: true,
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        assignee: issue.assignee,
      },
      message: `이슈가 성공적으로 생성되었습니다: ${issue.identifier}`,
    });
  } catch (error) {
    console.error("API 오류:", error);
    res.status(500).json({
      error: error.message,
      success: false,
    });
  }
});

// Discord Bot 로그인 및 서버 시작
async function startServer() {
  try {
    console.log("🤖 Discord 봇 로그인 시도 중...");
    console.log("🔍 토큰 길이:", DISCORD_TOKEN ? DISCORD_TOKEN.length : 0);
    console.log("🌍 환경:", process.env.NODE_ENV || "development");
    console.log("📡 Render 환경 여부:", process.env.RENDER ? "예" : "아니오");

    // Discord 봇 이벤트 리스너 설정
    client.on(Events.ClientReady, () => {
      console.log(`✅ Discord 봇 로그인 성공: ${client.user.tag}`);
      console.log(`🆔 봇 ID: ${client.user.id}`);
      console.log(`📊 봇이 ${client.guilds.cache.size}개의 서버에 참여 중`);
    });

    client.on(Events.Error, (error) => {
      console.error("❌ Discord 봇 에러:", error);
    });

    client.on(Events.Warn, (info) => {
      console.warn("⚠️ Discord 봇 경고:", info);
    });

    // Render 무료 플랜 대응: 연결 끊김 시 재연결
    client.on(Events.ShardDisconnect, (event) => {
      console.warn("⚠️ Discord 연결 끊김:", event);
      console.log("🔄 10초 후 재연결 시도...");
      setTimeout(() => {
        if (!client.isReady()) {
          console.log("🔄 재연결 시도 중...");
          client.login(DISCORD_TOKEN).catch((err) => {
            console.error("❌ 재연결 실패:", err);
          });
        }
      }, 10000);
    });

    // 로그인 시도
    console.log("🔐 Discord API에 연결 시도 중...");
    await client.login(DISCORD_TOKEN);

    // Discord 봇이 준비될 때까지 대기 (최대 30초)
    let waitTime = 0;
    const maxWaitTime = 30000;
    const checkInterval = 1000;

    while (!client.isReady() && waitTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
      console.log(`⏳ Discord 봇 준비 대기 중... (${waitTime / 1000}초)`);
    }

    if (!client.isReady()) {
      console.warn("⚠️ Discord 봇 로그인 타임아웃, 서버는 시작합니다");
    }

    // Express 서버 시작
    app.listen(PORT, () => {
      console.log(`🌐 Express 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log("🚀 서버가 성공적으로 시작되었습니다!");
    });

    // Render Keep-Alive: 5분마다 상태 로그
    setInterval(() => {
      console.log(
        "🔄 Keep-Alive ping:",
        new Date().toISOString(),
        "Bot ready:",
        client.isReady()
      );
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("❌ 서버 시작 실패:", error);
    process.exit(1);
  }
}

// 서버 시작
startServer();
