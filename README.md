# Face Beauty — 실시간 웹캠 얼굴 보정

브라우저에서 웹캠 영상을 실시간으로 가져와 얼굴을 보정하는 거울형 웹앱. 빌드 도구 없이 순수 HTML + Vanilla JS + WebGL로 동작하며 데스크톱·모바일(iOS Safari 포함) 양쪽을 지원합니다.

## 기능

- **실시간 보정**: 얼굴 축소(소두), 턱 갸름(V라인), 눈 확대, 코 좁힘·높이, 입술 크기, 피부 매끈
- **강도 슬라이더** + 프리셋 (자연 / 소두 / V라인 / 큰 눈)
- **좌우반전·회전** 보기 컨트롤, 전후면 카메라 전환
- **사진 저장(PNG)** 및 **동영상 녹화(WebM/MP4)**
- 모바일 자동 최적화 (해상도·커널·검출 주기 조절)

## 기술 스택

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe) — 468 랜드마크 실시간 추출 (CDN, GPU)
- WebGL2 fragment shader — liquify 워핑 + bilateral 피부 스무딩
- MediaRecorder API — 캔버스 스트림 녹화

## 실행

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 열기. (`getUserMedia`는 HTTPS 또는 `localhost`에서만 동작)

### 모바일 테스트

HTTPS가 필요하므로 GitHub Pages 배포 또는 `ngrok http 8000` 터널을 사용하세요.

## 라이선스

MIT
