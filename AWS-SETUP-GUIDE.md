# AWS Lambda + EventBridge 배포 가이드

Discord Bot Keep Alive 시스템을 AWS에 배포하는 방법입니다.

## 🔧 사전 준비

### 1. AWS 계정 생성

1. https://aws.amazon.com 접속
2. "Create an AWS Account" 클릭
3. 계정 생성 완료

### 2. AWS CLI 설치

```bash
# macOS (Homebrew)
brew install awscli

# Windows (Chocolatey)
choco install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 3. AWS 자격 증명 설정

```bash
aws configure
```

다음 정보 입력:

- **AWS Access Key ID**: AWS 콘솔에서 생성
- **AWS Secret Access Key**: AWS 콘솔에서 생성
- **Default region name**: `ap-northeast-2` (서울)
- **Default output format**: `json`

## 🔑 AWS Access Key 생성 방법

1. **AWS 콘솔 접속**: https://console.aws.amazon.com
2. **IAM 서비스** → **사용자** → **보안 자격 증명**
3. **액세스 키 만들기** 클릭
4. **Command Line Interface (CLI)** 선택
5. **액세스 키** 다운로드 및 안전하게 보관

## 🚀 배포 실행

### 1. Render URL 설정

`deploy-aws.sh` 파일에서 실제 Render URL로 변경:

```bash
RENDER_URL="https://your-actual-app.onrender.com"
```

### 2. 배포 스크립트 실행

```bash
./deploy-aws.sh
```

### 3. 배포 확인

스크립트가 다음을 자동으로 생성합니다:

- ✅ **Lambda 함수**: `discord-bot-keepalive`
- ✅ **EventBridge 규칙**: `discord-bot-keepalive-rule`
- ✅ **IAM 역할**: Lambda 실행 권한

## 📊 모니터링

### 1. AWS Lambda 콘솔

- **함수**: `discord-bot-keepalive`
- **모니터링**: 실행 로그 및 메트릭 확인

### 2. EventBridge 콘솔

- **규칙**: `discord-bot-keepalive-rule`
- **상태**: ENABLED 확인

### 3. CloudWatch Logs

- **로그 그룹**: `/aws/lambda/discord-bot-keepalive`
- **실시간 로그**: Lambda 실행 결과 확인

## 💰 비용

### 무료 티어 (월별)

- **Lambda**: 100만 요청까지 무료
- **EventBridge**: 100만 이벤트까지 무료
- **CloudWatch Logs**: 5GB까지 무료

### 예상 비용

- **5분 간격**: 월 8,640회 실행
- **비용**: 거의 무료 (무료 티어 내)

## 🛠️ 관리 명령어

### 스택 삭제

```bash
aws cloudformation delete-stack --stack-name discord-bot-keepalive --region ap-northeast-2
```

### Lambda 함수 수동 실행

```bash
aws lambda invoke --function-name discord-bot-keepalive --region ap-northeast-2 --payload '{}' test.json
```

### EventBridge 규칙 상태 확인

```bash
aws events describe-rule --name discord-bot-keepalive-rule --region ap-northeast-2
```

## 🔍 문제 해결

### 1. 권한 오류

```bash
# IAM 역할 확인
aws iam get-role --role-name discord-bot-keepalive-LambdaExecutionRole-XXXXX
```

### 2. Lambda 함수 오류

```bash
# 로그 확인
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/discord-bot-keepalive
```

### 3. EventBridge 규칙 오류

```bash
# 규칙 상태 확인
aws events describe-rule --name discord-bot-keepalive-rule --region ap-northeast-2
```

## 🎯 성공 확인

배포 성공 후 다음을 확인하세요:

1. **Lambda 함수가 5분마다 실행되는지**
2. **Render 서버에 ping 요청이 가는지**
3. **Discord 봇이 계속 온라인인지**

## 📱 알림 설정 (선택사항)

CloudWatch 알림을 설정하여 문제 발생 시 알림을 받을 수 있습니다:

1. **CloudWatch** → **알림** → **알림 생성**
2. **메트릭**: Lambda 함수 오류율
3. **임계값**: 1회 이상 오류
4. **알림**: 이메일 또는 SNS

---

## 🎉 완료!

이제 AWS가 5분마다 자동으로 Discord 봇을 깨워줍니다!
