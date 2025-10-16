# Render 배포 가이드

Discord Bot을 Render Web Service로 배포하는 가이드입니다.

## 🚀 Render 배포 단계

### 1. GitHub에 코드 푸시
```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Render에서 새 Web Service 생성

1. [Render Dashboard](https://dashboard.render.com)에 로그인
2. "New +" → "Web Service" 클릭
3. GitHub 리포지토리 연결
4. 다음 설정으로 서비스 생성:

#### 기본 설정
- **Name**: `onsurvey-discord-bot`
- **Environment**: `Node`
- **Region**: `Oregon (US West)` (무료 플랜)
- **Branch**: `main`
- **Root Directory**: (비워둠)

#### Build & Deploy 설정
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### Environment Variables
다음 환경 변수들을 추가:
- `DISCORD_TOKEN`: Discord Bot 토큰
- `LINEAR_API_KEY`: Linear API 키
- `LINEAR_TEAM_KEY`: Linear 팀 키 (선택사항)
- `NODE_ENV`: `production`

#### Advanced 설정
- **Health Check Path**: `/health`
- **Auto-Deploy**: `Yes`

### 3. 배포 완료 후 확인

배포가 완료되면:
1. Render 대시보드에서 서비스 상태 확인
2. 제공된 URL로 접속하여 health check 확인
3. Discord에서 봇이 온라인인지 확인

## 🔧 주요 기능

### Health Check 엔드포인트
- **GET /**: 봇 상태 및 서버 정보
- **GET /health**: 외부 ping 서비스용 간단한 health check

### API 엔드포인트
- **POST /api/create-issue**: Linear 이슈 생성 API

## 📊 모니터링

### 로그 확인
Render 대시보드의 "Logs" 탭에서 실시간 로그 확인 가능

### 외부 Ping 서비스 설정 (선택사항)
봇이 항상 활성 상태를 유지하도록 외부 ping 서비스 사용:

1. **UptimeRobot** (추천)
   - URL: `https://your-app-name.onrender.com/health`
   - Interval: 5분
   - Monitor Type: HTTP(s)

2. **Pingdom**
   - URL: `https://your-app-name.onrender.com/health`
   - Check Interval: 5분

3. **StatusCake**
   - URL: `https://your-app-name.onrender.com/health`
   - Check Period: 5분

## 💰 비용

- **무료 플랜**: 월 750시간 (약 31일)
- **단점**: 15분간 요청이 없으면 sleep
- **해결책**: 외부 ping 서비스로 keep-alive

## 🛠️ 트러블슈팅

### 봇이 오프라인인 경우
1. Render 로그에서 오류 메시지 확인
2. 환경 변수가 올바르게 설정되었는지 확인
3. Discord Bot 토큰이 유효한지 확인

### 서비스가 sleep 상태인 경우
1. 외부 ping 서비스 설정 확인
2. `/health` 엔드포인트가 정상 작동하는지 확인

### 빌드 실패 시
1. `package.json`의 의존성 확인
2. Node.js 버전 호환성 확인
3. 빌드 로그에서 구체적인 오류 메시지 확인

## 🔒 보안

- 환경 변수는 Render의 Environment Variables에서 설정
- `.env` 파일은 Git에 커밋하지 않음
- Linear API 키와 Discord 토큰은 안전하게 보관

## 📝 사용법

Discord에서 다음 명령어로 이슈 생성:
```
!이슈생성 버그 수정하기-홍길동
```

이 명령어는:
- 제목: "버그 수정하기"
- 담당자: "홍길동"
- Linear에 이슈 생성
- Discord URL 포함
