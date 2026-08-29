# 전적 DB 세팅 가이드 (Turso + 버셀)

전적 DB는 **Turso**(libSQL, SQLite 호환 클라우드)에 저장됩니다.
코드는 이미 다 붙어 있고, 아래는 **직접 하셔야 하는 것**만 정리한 것입니다.

> **환경변수를 안 넣어도 개발은 됩니다.** `TURSO_DATABASE_URL` 이 없으면 자동으로
> 로컬 파일 `data/lumisum.db` 에 저장합니다. 아래 작업은 **버셀에 올릴 때** 필요합니다.
> (버셀은 서버 파일 쓰기가 막혀 있어서 로컬 파일 모드로는 저장이 실패합니다.)

---

## 1. Turso CLI 설치

Windows에서는 WSL 안에서 설치하는 게 가장 쉽습니다.

```bash
curl -sSfL https://tur.so/install.sh | bash
```

설치 후 터미널을 새로 열고 확인:

```bash
turso --version
```

CLI 없이 하고 싶으면 <https://turso.tech> 웹 대시보드에서 2~3단계를 그대로 할 수 있습니다.

## 2. 가입 / 로그인

```bash
turso auth signup     # 이미 계정이 있으면 turso auth login
```

브라우저가 열리면 GitHub 계정으로 승인하면 됩니다.

## 3. DB 만들고 접속 정보 뽑기

```bash
turso db create lumisum
```

만들어졌으면 값 두 개를 뽑습니다. **이 두 줄의 출력이 곧 환경변수 값**입니다.

```bash
turso db show lumisum --url        # libsql://lumisum-xxxx.turso.io  → TURSO_DATABASE_URL
turso db tokens create lumisum     # eyJhbGciOi...                   → TURSO_AUTH_TOKEN
```

> 토큰은 비밀번호입니다. 깃에 커밋하거나 남에게 보여주지 마세요.
> 실수로 유출됐으면 `turso db tokens invalidate lumisum` 으로 전부 무효화하고 다시 발급하면 됩니다.

## 4. 로컬 `.env` 에 넣기

프로젝트 루트의 `.env.example` 을 `.env` 로 복사하고 3단계에서 얻은 값을 채웁니다.

```bash
cp .env.example .env
```

```env
TURSO_DATABASE_URL=libsql://lumisum-xxxx.turso.io
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
| `TURSO_DATABASE_URL` | `libsql://lumisum-xxxx.turso.io` | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` | Production, Preview, Development |

> 환경변수는 **추가한 뒤 다시 배포해야** 반영됩니다. 이미 배포돼 있으면
> Deployments 에서 최신 배포를 **Redeploy** 하세요.

## 6. 기존 로컬 기록 옮기기 (선택)

지금 `data/lumisum.db` 에 저장된 기록이 있고 그걸 살리고 싶을 때만 하면 됩니다.
새로 시작할 거면 건너뛰세요.

```bash
sqlite3 data/lumisum.db .dump > dump.sql
turso db shell lumisum < dump.sql
```

## 7. 확인

배포된 사이트에서:

1. **점수 계산기** 탭에서 CSV 로 판을 하나 추가
2. **전적 DB에 저장** 클릭 → `N판을 저장했습니다` 가 뜨면 성공
3. **통산 전적** 탭에서 인원별 평균 점수가 보이는지 확인
4. 다른 기기(폰 등)에서 통산 전적 탭을 열어 **같은 데이터가 보이면** 서버 저장이 제대로 된 것

`저장 실패:` 문구가 뜨면 환경변수 이름 오타이거나 재배포를 안 한 경우가 대부분입니다.

---

## 알아두면 좋은 것

- **무료 티어로 충분합니다.** 내전 기록은 한 판에 24행이라, 수백 판을 쌓아도 용량이 몇 MB 수준입니다.
- **내전 1회 = 세션 1개**입니다. 같은 세션을 다시 저장하면 덮어쓰므로, 판을 더 추가하고 다시 눌러도 중복으로 쌓이지 않습니다. 계산기에서 **전체 초기화**를 하면 그다음 저장부터 새 세션이 됩니다.
- **배점을 바꿔도 과거 기록이 안 깨집니다.** DB에는 순위점·킬점·터미네이트 횟수·탈출 횟수만 들어가고, 점수는 통산 전적 페이지의 배점 값으로 매번 다시 계산합니다.
- **DB 안을 직접 들여다보려면** `turso db shell lumisum` 으로 SQL 을 바로 칠 수 있습니다.

  ```sql
  SELECT session_id, COUNT(DISTINCT game_id) FROM match_players GROUP BY session_id;
  ```
