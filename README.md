# Simple Persona

SillyTavern 페르소나 버튼을 가로채서 깔끔한 커스텀 창으로 대체해주는 확장입니다.

## 기능

- 현재 선택된 페르소나를 상단에 항상 표시
- 전체 페르소나 그리드 표시 + 검색
- 클릭으로 페르소나 빠르게 전환
- 개별 페르소나 PNG + JSON 내보내기
- PNG + JSON 불러오기
- SillyTavern의 현재 테마 색상 자동 적용

## 설치 방법

1. `simple-persona` 폴더 전체를 아래 경로에 복사하세요:

```
SillyTavern/public/extensions/third-party/simple-persona/
```

2. SillyTavern을 새로고침합니다.

3. 상단 메뉴 → 확장(Extensions) → Simple Persona 활성화

4. 이제 페르소나 버튼을 누르면 커스텀 창이 뜹니다!

## 파일 구조

```
simple-persona/
  manifest.json   ← 확장 메타정보
  index.js        ← 메인 로직
  style.css       ← 스타일 (테마 변수 사용)
  README.md       ← 이 파일
```

## 내보내기 / 불러오기

- **내보내기**: 카드에 마우스를 올리면 나타나는 다운로드 버튼 클릭 → PNG + JSON 두 파일 저장
- **불러오기**: 상단 `불러오기` 버튼 → PNG 파일 또는 JSON 파일(또는 둘 다) 선택

> JSON 파일에는 이름, 설명, 위치 정보가 담겨 있습니다.
