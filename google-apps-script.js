/**
 * Google Apps Script - Discord Bot Keep Alive
 *
 * 설정 방법:
 * 1. https://script.google.com 접속
 * 2. 새 프로젝트 생성
 * 3. 이 코드 붙여넣기
 * 4. 트리거 설정: 5분마다 실행
 */

function keepAlive() {
  const url = "https://onsurvey-discord-bot.onrender.com/ping";

  try {
    console.log("🏓 Pinging Discord Bot...");

    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Google-Apps-Script/1.0)",
        Accept: "*/*",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log(`📊 Status: ${statusCode}`);
    console.log(`📄 Response: ${responseText}`);

    if (statusCode === 200) {
      console.log("✅ Ping successful!");
      return {
        success: true,
        statusCode: statusCode,
        message: "Discord bot is alive",
      };
    } else {
      console.log("⚠️ Ping returned non-200 status");
      return {
        success: false,
        statusCode: statusCode,
        message: "Discord bot may be down",
      };
    }
  } catch (error) {
    console.error("❌ Ping failed:", error.toString());
    return {
      success: false,
      error: error.toString(),
      message: "Failed to ping Discord bot",
    };
  }
}

// 테스트용 함수
function testPing() {
  const result = keepAlive();
  console.log("Test result:", result);
  return result;
}
