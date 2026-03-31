# 미국 시가총액 Top 10 투자 시스템

미국 시가총액 상위 10개 기업을 추적하고, 순위 변동 시 자동으로 리밸런싱하는 투자 전략 대시보드입니다.

## 기능

- 실시간 Top 10 기업 리스트: 시가총액, 업종, 재무지표
- 순위 변동 알림: 10위 밖으로 나가는 기업 감지 시 브라우저 알림
- 자동 리밸런싱: 탈락 기업 매도 → 신규 진입 기업 동일 금액 매수
- 10년 백테스트: Top10 전략 vs S&P500 vs 나스닥100 vs 다우존스 vs KOSPI
- 반응형 디자인: Galaxy Z Fold 7 포함 모든 디바이스 지원

## 배포

```bash
npm install
npm run deploy
```

## 기술 스택

- HTML5 / CSS3 / Vanilla JavaScript
- Chart.js
- Cloudflare Pages
