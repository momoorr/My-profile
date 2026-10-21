# ALEPH T04 — 오늘의 진짜 정보판

## 상태
**공식 ZIP 통합 버전 / 검증용 빌드. T04 전체 완료 또는 제출 승인 상태 아님.**

화이트·차콜·파스텔 하늘색 3색으로 만든 웹 정보판입니다. 기존 T01~T03를 건드리지 않고 `My-profile/t04/`로 배포할 수 있습니다.

## 구성

- **실제 공개 데이터**: Open-Meteo, 서울 고정 위치의 모델 기반 현재 기온. 실제 응답만 값·°C·제공처·원천 시각·조회 시각·KST 시간대와 함께 표시합니다. 외부 계정이나 키를 사용하지 않습니다.
- **날짜별 기록**: `localStorage` 키 `aleph.t04.public-weather.v2`에 정상 기록만 저장합니다. 기준 날짜는 `Asia/Seoul`이며 같은 날짜는 `signal_id + record_date`에 해당하는 같은 ID로 갱신하고, 새로운 날짜는 새 행으로 남깁니다. 상태 기록 전체를 한 번의 localStorage 쓰기로 갱신하지만, **여러 기기·탭 간 DB 트랜잭션 수준의 원자성은 보장하지 않습니다.**
- **차이 계산**: KST 어제·오늘의 실제 기록이 모두 있을 때만 현재 기록 - 어제 기록으로 계산합니다. 어제 기록이 없다면 값을 추정하지 않습니다.
- **실패 시**: 정상값을 덮어쓰지 않고 마지막 정상값을 **오래된 값**으로 표시합니다. 사용자 재시도 버튼을 제공합니다.
- **공식 fixture**: 9개 fixture의 원본을 `official-assets/fixtures/`에 보존하고, 번들된 데이터로 로컬 파일에서도 재생합니다. fixture 검사는 별도 휘발성 메모리에서 진행하며 실제 API 조회·실제 날짜 기록을 수정하지 않습니다.

### 공식 고정 자산 확인

사용자가 제출한 `t04-real-information-board-public-v1.zip`에서 제공된 `asset-manifest.json`과 나머지 17개 파일을 길이/ SHA-256 기준으로 확인했습니다. **17/17 일치**. 원본은 `official-assets/`에 보존했습니다. `official-adapter.js`는 공식 `adapter-reset.example.js`의 모듈 export 부분만 브라우저 전역 연결로 바꾼 것입니다.

### 실행

`index.html` 더블클릭으로 열 수 있습니다. 외부 API를 직접 호출하기 때문에 브라우저의 `file://` 정책·CORS나 네트워크 상태에 따라 실제 기온 조회가 실패할 수 있습니다. 가능한 경우 GitHub Pages에서 테스트하세요. fixture는 라이브러리 설치/서버 요청 없이 동작합니다.

**PowerShell 업로드 예시** (기존 `My-profile` 저장소 유지, 복제 중첩 방지):

```powershell
cd "$env:USERPROFILE\Downloads\My-profile-upload"
git pull --ff-only origin main
Copy-Item "$env:USERPROFILE\Downloads\aleph_t04" ".\t04" -Recurse -Force
Get-ChildItem .\t04
git add t04
git commit -m "Add T04 live information board and official fixtures"
git push origin main
```

GitHub Pages 예상 경로: `https://momoorr.github.io/My-profile/t04/` (배포 확인 필요). 제출 소스 URL은 저장소 폴더 링크가 아닌 **최종 40자리 커밋 URL**로 제출하세요.

## 실제 검증 순서

1. 공개 사이트를 열고 성공 응답인지 확인. 값·단위·출처·원천 시각·조회 시각·기준 시간대를 확인하고 `기록 CSV 저장` 클릭.
2. 공식 재생 구역: **날짜별 저장 3단계** → D1-A 100, D1-B 105 동일 행 ID 및 1행, D2 120 2행 +15.
3. **다섯 실패 자동 검사** → 다섯 오류 모두 PASS, 기존 정상값 105와 일별 기록 1행 유지, `stale` 상태.
4. **시간 초과 재현** → `stale/timeout`, 오래된 값 105, 1행 → **다시 시도 · D2 회복** → `fresh/none`, 120, 2행 +15.
5. 별도로 실제 KST 다른 날짜(예: 10월 21일, 10월 22일)에 성공 응답을 각각 조회하고 실제 날짜 기록 2건 및 어제 대비 계산 확인.
6. 새 시크릿 창에서 결과물·소스 URL이 계정, 로그인, OAuth, CAPTCHA 등 없이 열리는지 확인.

## 중요: 공식 live 증거/영수증 계약

- **합성 fixture 날짜 `2026-08-24/25`는 실제 날짜 조회 증거가 절대 아닙니다.**
- 실제 날짜는 클라이언트 브라우저 KST 날짜 기준이며 다른 실제 날짜를 기다려야 합니다. 시계를 조작하거나 합성 테스트 값을 실제 기록으로 제출하지 마세요.
- 현재 정적 GitHub Pages 앱은 `localStorage`만 사용하므로, **다른 방문자의 브라우저나 ALEPH 평가 서버가 학생 브라우저 기록을 자동으로 조회할 수 없습니다.** 그러므로 이것만으로 공식 `T04-C22~C24` 통과가 보장되지 않습니다.
- 공식 계약은 ALEPH가 봉인한 `제출정보.json.과정영수증[]`에 canonical kind `t04_day` 영수증 **정확히 2건**(서로 다른 KST `server_created_at` 날짜)을 요구합니다. 각 payload의 `source_url`, `source_observed_at`, `normalized_value`, `unit`과 보존된 저장값 및 화면값이 같아야 하고, 차이도 재계산 가능해야 합니다.
- 영수증은 학생이 직접 만들거나 날짜를 위조하지 않습니다. ALEPH 플랫폼의 발급/봉인 절차를 확인하고 필요한 경우 공식 플랫폼 안내에 따라 두 날짜의 실제 기록을 저장/증빙하세요. 이 버전은 영수증 발급 기능이 없습니다.
- 정적 localStorage 방식이 채점 환경의 공유 저장 요구를 충족하는지도 추가 확인해야 합니다. 필요할 경우 **로그인·비밀 없는 서버 측 저장소와 원자적 upsert**로 바꾸어야 할 수 있습니다.

## 공개 전 점검

- 비밀번호·API key·토큰·개인 기록을 코드, Git history, 브라우저 네트워크 응답, 제출 파일에 넣지 않기.
- 실제 날씨 기온은 Open-Meteo 모델 기반이며 현장 관측소의 계측값이 아님을 명시.
- 공식 fixture URL(`fixtures.aleph.invalid`)은 테스트용 원천명이며 실제 API가 아님.
- `TEST_LOG.md`의 완료/미완료를 사실 그대로 유지.
