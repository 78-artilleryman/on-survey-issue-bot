#!/bin/bash

# AWS Lambda + EventBridge 배포 스크립트
# Discord Bot Keep Alive 시스템

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정 변수
STACK_NAME="discord-bot-keepalive"
REGION="ap-northeast-2"  # 서울 리전
RENDER_URL="https://onsurvey-discord-bot.onrender.com"  # 실제 Render URL로 변경하세요

echo -e "${BLUE}🚀 AWS Lambda + EventBridge 배포 시작${NC}"
echo -e "${BLUE}================================${NC}"

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI가 설치되지 않았습니다.${NC}"
    echo -e "${YELLOW}설치 방법: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html${NC}"
    exit 1
fi

# AWS 자격 증명 확인
echo -e "${YELLOW}🔍 AWS 자격 증명 확인 중...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS 자격 증명이 설정되지 않았습니다.${NC}"
    echo -e "${YELLOW}설정 방법: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS 자격 증명 확인 완료${NC}"

# 현재 AWS 계정 정보 출력
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}📋 AWS 계정 ID: ${ACCOUNT_ID}${NC}"
echo -e "${BLUE}📋 리전: ${REGION}${NC}"
echo -e "${BLUE}📋 스택 이름: ${STACK_NAME}${NC}"
echo -e "${BLUE}📋 Render URL: ${RENDER_URL}${NC}"

echo ""

# CloudFormation 스택 배포
echo -e "${YELLOW}☁️  CloudFormation 스택 배포 중...${NC}"
aws cloudformation deploy \
    --template-file cloudformation-template.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        RenderUrl=$RENDER_URL \
        ScheduleExpression="rate(5 minutes)" \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CloudFormation 스택 배포 완료${NC}"
else
    echo -e "${RED}❌ CloudFormation 스택 배포 실패${NC}"
    exit 1
fi

# Lambda 함수 테스트
echo -e "${YELLOW}🧪 Lambda 함수 테스트 중...${NC}"
aws lambda invoke \
    --function-name discord-bot-keepalive \
    --region $REGION \
    --payload '{}' \
    response.json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda 함수 테스트 완료${NC}"
    echo -e "${BLUE}📄 응답 내용:${NC}"
    cat response.json | jq '.' 2>/dev/null || cat response.json
    rm -f response.json
else
    echo -e "${RED}❌ Lambda 함수 테스트 실패${NC}"
fi

# EventBridge 규칙 확인
echo -e "${YELLOW}📅 EventBridge 규칙 확인 중...${NC}"
aws events describe-rule \
    --name discord-bot-keepalive-rule \
    --region $REGION \
    --query 'State' \
    --output text

echo ""

# 배포 완료 정보
echo -e "${GREEN}🎉 배포 완료!${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ Lambda 함수: discord-bot-keepalive${NC}"
echo -e "${GREEN}✅ EventBridge 규칙: discord-bot-keepalive-rule${NC}"
echo -e "${GREEN}✅ 스케줄: 5분마다 실행${NC}"
echo -e "${GREEN}✅ 대상: ${RENDER_URL}/ping${NC}"
echo ""
echo -e "${YELLOW}📊 모니터링 방법:${NC}"
echo -e "${BLUE}1. AWS Lambda 콘솔에서 함수 로그 확인${NC}"
echo -e "${BLUE}2. CloudWatch Logs에서 실행 로그 확인${NC}"
echo -e "${BLUE}3. EventBridge 콘솔에서 규칙 상태 확인${NC}"
echo ""
echo -e "${YELLOW}💰 예상 비용:${NC}"
echo -e "${BLUE}- Lambda: 월 100만 요청까지 무료${NC}"
echo -e "${BLUE}- EventBridge: 월 100만 이벤트까지 무료${NC}"
echo -e "${BLUE}- CloudWatch Logs: 월 5GB까지 무료${NC}"
echo -e "${GREEN}→ 거의 무료로 사용 가능!${NC}"
echo ""
echo -e "${YELLOW}🛠️  관리 명령어:${NC}"
echo -e "${BLUE}# 스택 삭제:${NC}"
echo -e "${BLUE}aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION${NC}"
echo ""
echo -e "${BLUE}# Lambda 함수 수동 실행:${NC}"
echo -e "${BLUE}aws lambda invoke --function-name discord-bot-keepalive --region $REGION --payload '{}' test.json${NC}"
