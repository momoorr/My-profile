# SIGNAL 30 — ALEPH T02

## 게임 규칙

- 30초 동안 1초마다 들어오는 **30개의 신호**에 반응합니다.
- 신호가 하늘색으로 켜졌을 때 `신호 잡기` 버튼을 클릭하거나, Tab으로 그 버튼에 초점을 맞춘 뒤 Enter/Space를 누르면 **1점**입니다.
- 신호 하나당 판정은 한 번입니다. 꺼졌을 때 누르거나 끝까지 누르지 않으면 해당 신호를 놓칩니다.
- **30초 종료 시 16점 이상 성공, 15점 이하 실패**입니다. 30초 끝나면 결과가 바로 표시되고 다음 판을 시작할 수 있습니다.
- `일시정지` 중에는 시계가 멈추고 `이어하기`로 남은 시간부터 재개됩니다. 탭이 숨겨져도 자동 일시정지합니다.
- 플레이 중 `다시 시작`을 누르면 그 판은 취소되며, 미완료 판은 실험 기록에 남지 않습니다.

## 난이도 변경 실험

- 고정값: 30초 게임, 초당 1개 신호, 16개 이상 성공, 마우스/키보드 조작 동일.
- **오직 한 값 `LIGHT_ON_MS`만 변경**: 기본 700ms → 조정 450ms.
- 처음 10판 완료 후 화면의 `난이도 변경` 버튼을 누르고 추가 10판을 진행합니다.
- 20판을 마치면 기본·조정의 평균 점수와 성공 판 수가 비교 화면에 표시됩니다. **CSV 내보내기**로 실측 기록을 저장하세요.
- 중간에 새로고침해도 완료된 각 판의 기록은 `localStorage`에 유지됩니다. 미완료 판은 복구하지 않습니다.

## 파일/배포

- `index.html` `styles.css` `script.js`만 있으면 실행됩니다. 외부 라이브러리·이미지·로그인이 없습니다.
- 기존 T01 GitHub 저장소 **`momoorr/My-profile`의 `t02/` 폴더**에 세 파일을 넣으면 T01을 덮어쓰지 않습니다.
- GitHub Pages URL (배포 전 예상 주소이며 배포 후 시크릿 창 확인 필수): `https://momoorr.github.io/My-profile/t02/`
- 소스 URL은 `git rev-parse HEAD`로 얻은 **최종 40자리 커밋 ID**를 사용하여 `https://github.com/momoorr/My-profile/commit/<SHA>` 형태로 작성합니다.
- T01의 `index.html`, `styles.css`, `script.js`는 저장소 루트에 그대로 둡니다.

## PowerShell 업로드

이 파일을 담은 `aleph_t02` 폴더를 다운로드 폴더에 둔 경우:

```powershell
cd "$env:USERPROFILE\Downloads\My-profile-upload"
New-Item -ItemType Directory -Force .\t02 | Out-Null
Copy-Item "$env:USERPROFILE\Downloads\aleph_t02\index.html" .\t02\index.html
Copy-Item "$env:USERPROFILE\Downloads\aleph_t02\styles.css" .\t02\styles.css
Copy-Item "$env:USERPROFILE\Downloads\aleph_t02\script.js" .\t02\script.js
git status
git add t02
git commit -m "Add T02 signal timing game"
git push origin main
git rev-parse HEAD
```

압축 파일을 먼저 푼 폴더 위치가 다르면 `Copy-Item`의 원본 경로만 바꾸면 됩니다. **다시 `git init`하거나 T01 파일을 덮어쓰지 마세요.**

## 수행자가 직접 확인해야 하는 검사

`TEST_LOG.md`의 체크 목록을 실제로 확인하며 채웁니다.

1. 1366×768, 1920×1080에서 조작 영역이 잘리지 않는지, 가로 스크롤이 없는지.
2. 1초 내 연속 입력과 포커스 이동, 일시정지(30초가 흐르지 않음)/복귀 확인.
3. 중단 후 재시작, 10분 연속 실행 뒤 콘솔 오류 0건 확인.
4. 기본 10판+조정 10판 (각 30초; 총 10분 순수 플레이) 기록을 CSV로 내보내고 **난이도 값 한 개만 바뀐 이유** 작성.
5. 초기화 확인은 확인 대화상자 취소→유지, 확인→초기화 모두 검사. **기존 20판 기록 백업 후 진행**.
6. 빈·손상 저장소 검사는 새 시크릿 창에서 수행하세요. 기존 20판 기록에 영향을 주지 않습니다.
   - 빈 저장소: 시크릿 창 첫 방문 후 `0/10` 표기 및 게임 시작 확인.
   - 손상 저장소: 시크릿 창에서 `F12 → Console` 입력: `localStorage.setItem('aleph.t02.signal30.v1', '{broken')` 후 새로고침. 손상 기록 복구 메시지 및 시작 가능 상태 확인.
7. 음소거 체크 해제 시 소리가 멈추고 다시 소리가 나지 않는지, 움직임 줄이기 선택 시 장식 전환 효과가 사라지는지 확인.
8. 페이지·소스·CSV에 개인식별정보/비밀번호/토큰/API 키가 없는지 확인.

**주의**: 위 항목은 사용자 실제 수행 후만 '통과'로 작성하세요. 테스트 20판의 결과나 수정한 버그를 임의로 만들지 않습니다.

## 제출 문구 안내

- 결과 URL: 배포 후 새 시크릿 창에서 검증한 `https://momoorr.github.io/My-profile/t02/`
- 소스 URL: 최종 커밋의 전체 SHA URL
- 재현·통과 확인 4줄: 위치 / 3단계 이내 조작 / 통과 모습 / 실패 시 확인 순서
- AI와 내 판단 3줄: AI 맡긴 일 / 직접 선택한 일 / AI 제안을 따르지 않은 일(또는 없었다면 이유)
