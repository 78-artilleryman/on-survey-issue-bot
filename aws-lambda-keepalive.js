/**
 * AWS Lambda 함수 - Discord Bot Keep Alive
 * EventBridge에서 5분마다 호출되어 Render 서버를 깨워줍니다.
 */

const https = require("https");
const http = require("http");

exports.handler = async (event) => {
  console.log("EventBridge Keep-Alive triggered:", new Date().toISOString());

  // Render 앱 URL (환경 변수에서 가져오거나 하드코딩)
  const RENDER_URL =
    process.env.RENDER_URL || "https://onsurvey-discord-bot.onrender.com";
  const PING_ENDPOINT = `${RENDER_URL}/ping`;

  console.log(`Pinging: ${PING_ENDPOINT}`);

  try {
    const result = await pingServer(PING_ENDPOINT);

    console.log("Keep-alive ping successful:", {
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      timestamp: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Keep-alive ping successful",
        target: PING_ENDPOINT,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Keep-alive ping failed:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Keep-alive ping failed",
        error: error.message,
        target: PING_ENDPOINT,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

/**
 * 서버에 HTTP 요청을 보내는 함수
 * @param {string} url - 요청할 URL
 * @returns {Promise<Object>} - 응답 결과
 */
function pingServer(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const isHttps = url.startsWith("https://");
    const client = isHttps ? https : http;

    const req = client.get(
      url,
      {
        timeout: 30000, // 30초 타임아웃
        headers: {
          "User-Agent": "AWS-Lambda-KeepAlive/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const responseTime = Date.now() - startTime;

          try {
            const jsonData = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              responseTime: responseTime,
              data: jsonData,
            });
          } catch (parseError) {
            resolve({
              statusCode: res.statusCode,
              responseTime: responseTime,
              data: data,
            });
          }
        });
      }
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.setTimeout(30000);
  });
}
