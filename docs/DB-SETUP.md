# 전적 DB 세팅 가이드 (Turso + 버셀)

전적 DB는 **Turso**(libSQL, SQLite 호환 클라우드)에 저장됩니다.
코드는 이미 다 붙어 있고, 아래는 **직접 하셔야 하는 것**만 정리한 것입니다.

**터미널·CLI·WSL 전부 필요 없습니다.** 전 과정이 브라우저에서 끝납니다.
(마지막 6단계 데이터 이전만 `node` 명령 한 줄을 쓰는데, 새로 시작할 거면 건너뛰어도 됩니다.)

> **환경변수를 안 넣어도 개발은 됩니다.** `TURSO_DATABASE_URL` 이 없으면 자동으로
> 로컬 파일 `data/lumisum.db` 에 저장합니다. 아래 작업은 **버셀에 올릴 때** 필요합니다.
> 버셀은 서버 파일 쓰기가 막혀 있어서 로컬 파일 모드로는 저장이 실패합니다.

---

## 1. Turso 가입

<https://turso.tech> → **Sign up** → GitHub 계정으로 승인.

계정은 반드시 있어야 합니다. 클라우드에 DB를 발급받는 거라 로그인 없이는 안 됩니다.
대신 **CLI 로그인(`turso auth login`)은 필요 없습니다** — 웹 대시보드로 전부 처리됩니다.

## 2. DB 만들기

대시보드에서 **Create Database** → 이름은 `lumisum` (아무거나 상관없음).
리전은 가까운 곳(예: `Tokyo / nrt`)을 고르면 응답이 조금 빠릅니다.

## 3. 접속 정보 두 개 복사

만든 DB를 클릭해서 들어가면 연결 정보를 보여주는 화면이 있습니다. 여기서 두 개를 챙깁니다.

| 챙길 것 | 생김새 | 들어갈 환경변수 |
| --- | --- | --- |
| Database URL | `libsql://lumisum-계정명.turso.io` | `TURSO_DATABASE_URL` |
| Auth Token | `eyJhbGciOi...` (아주 긺) | `TURSO_AUTH_TOKEN` |

토큰은 **생성 버튼을 눌러야 나오고, 창을 닫으면 다시 못 봅니다.** 바로 복사해서 붙여넣으세요.
잃어버리면 새로 발급하면 됩니다.

> 토큰은 비밀번호입니다. 깃에 커밋하거나 남에게 보여주지 마세요.
> 유출됐으면 대시보드에서 기존 토큰을 무효화(revoke)하고 다시 발급하세요.

## 4. 로컬 `.env` 에 넣기

프로젝트 루트의 `.env.example` 을 복사해서 `.env` 로 만들고 값을 채웁니다.

```env
TURSO_DATABASE_URL=libsql://lumisum-계정명.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

`.env` 는 `.gitignore` 에 있어서 커밋되지 않습니다.
`npm run dev` 를 다시 띄우면 이제 로컬 파일이 아니라 Turso 를 바라봅니다.

**테이블은 직접 만들 필요 없습니다.** 서버가 처음 뜰 때 `CREATE TABLE IF NOT EXISTS` 로 알아서 만듭니다.

## 5. 버셀 환경변수 등록

버셀 대시보드 → 해당 프로젝트 → **Settings → Environment Variables** 에서
같은 이름 두 개를 추가합니다.

| Name | Value | Environment |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | `libsql://lumisum-계정명.turso.io` | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` | Production, Preview, Development |

> 환경변수는 **추가한 뒤 다시 배포해야** 반영됩니다. 이미 배포돼 있으면
> Deployments 에서 최신 배포를 **Redeploy** 하세요. 저장이 안 되는 경우 대부분 이것 때문입니다.

## 6. 기존 로컬 기록 옮기기 (선택)

지금 `data/lumisum.db` 에 저장된 기록을 살리고 싶을 때만 하면 됩니다.
새로 시작할 거면 **건너뛰세요.**

4단계까지 끝냈으면 프로젝트 폴더에서 한 줄이면 됩니다.

```bash
node --env-file=.env scripts/migrate-to-turso.mjs
```

```
옮겼습니다 → 내전 1회 · 1판 · 24행 (탈출 0건)
```

여러 번 돌려도 같은 행은 덮어써서 중복되지 않습니다.

## 7. 확인

배포된 사이트에서:

1. **점수 계산기** 탭에서 CSV 로 판을 하나 추가
2. **전적 DB에 저장** 클릭 → `N판을 저장했습니다` 가 뜨면 성공
3. **통산 전적** 탭에서 인원별 평균 점수가 보이는지 확인
4. 다른 기기(폰 등)에서 통산 전적 탭을 열어 **같은 데이터가 보이면** 서버 저장이 제대로 된 것

`저장 실패:` 문구가 뜨면 환경변수 이름 오타이거나, 등록 후 재배포를 안 한 경우가 대부분입니다.

---

## 알아두면 좋은 것

- **무료 티어로 충분합니다.** 내전 기록은 한 판에 24행이라, 수백 판을 쌓아도 몇 MB 수준입니다.
- **내전 1회 = 세션 1개**입니다. 같은 세션을 다시 저장하면 덮어쓰므로, 판을 더 추가하고 다시 눌러도 중복으로 쌓이지 않습니다. 계산기에서 **전체 초기화**를 하면 그다음 저장부터 새 세션이 됩니다.
- **배점을 바꿔도 과거 기록이 안 깨집니다.** DB에는 순위점·킬점·터미네이트 횟수·탈출 횟수만 들어가고, 점수는 통산 전적 페이지의 배점 값으로 매번 다시 계산합니다.
- **DB 안을 직접 보고 싶으면** Turso 웹 대시보드에 SQL 콘솔이 있습니다.

  ```sql
  SELECT session_id, COUNT(DISTINCT game_id) FROM match_players GROUP BY session_id;
  ```
