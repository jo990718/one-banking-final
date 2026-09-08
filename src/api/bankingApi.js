/**
 * ====================================================================
 * [WON 뱅킹 실습 프로젝트 - bankingApi.js]
 * 
 * 💡 이 파일이 하는 일:
 * 1. 프론트엔드 화면(React)과 백엔드 서버(Node.js 포트 4000) 사이에서 데이터를 주고받는 "중간 다리" 역할입니다.
 * 2. 4000번 서버가 켜져 있으면: 실제 네트워크 통신(fetch)을 통해 최신 데이터를 가져옵니다.
 * 3. 4000번 서버가 꺼져 있거나 에러가 나면: 브라우저가 멈추거나 튕기지 않도록,
 *    아래 준비해 둔 "더미 데이터(가짜 데이터)"로 자동 전환(Fallback)되어 화면을 정상 표시합니다.
 * ====================================================================
 */

// 백엔드 Express 서버가 열려 있는 기본 주소입니다.
const BASE_URL = "https://one-banking-finaleo.onrender.com";

// ====================================================================
// [1. 오프라인 대비용 가짜 데이터(Mock Data) 원본 저장소]
// ====================================================================

// [계좌 목록 더미]
// const 대신 let을 쓴 이유: 오프라인 모드에서 이체 테스트를 할 때 실제로 가상의 잔액(balance)을 깎기 위해서입니다.
let mockAccounts = [
  {
    id: "acc-1",                  // 시스템 내부에서 계좌를 식별하는 고유 ID
    nickname: "우리 첫급여통장",    // 화면에 보여줄 통장의 이름
    accountNo: "1002-***-123456",  // 개인정보 보호용 마스킹 계좌번호
    balance: 2384560,             // 현재 남아있는 잔액 (숫자)
    type: "입출금",                // 통장의 종류/상품 유형
  },
  {
    id: "acc-2",
    nickname: "우리 SUPER주거래통장",
    accountNo: "1002-***-789012",
    balance: 15200000,
    type: "저축예금",
  },
  {
    id: "acc-3",
    nickname: "우리 청년도약계좌",
    accountNo: "1002-***-456789",
    balance: 5000000,
    type: "적금",
  },
];

// [거래내역 목록 더미]
// const 대신 let을 쓴 이유: 오프라인 모드에서 돈을 보냈을 때 새 거래내역을 맨 위에 실시간으로 끼워넣기 위해서입니다.
let mockTransactions = [
  {
    id: "tx-1",                   // 거래내역 하나하나를 구분하는 고유 번호
    accountId: "acc-1",           // 어떤 계좌에서 일어난 거래인지 연결하는 ID
    accountNickname: "우리 첫급여통장",
    date: "2026-08-23",           // 거래 날짜 (연-월-일)
    time: "14:20",                // 거래 시각 (시:분)
    desc: "스타벅스 강남점",       // 거래처 이름 또는 내용
    type: "out",                  // out은 출금(돈 나감), in은 입금(돈 들어옴)
    amount: 5800,                 // 거래 금액
    balanceAfter: 2384560,        // 거래가 끝난 직후 남은 통장 잔액
  },
  {
    id: "tx-2",
    accountId: "acc-1",
    accountNickname: "우리 첫급여통장",
    date: "2026-08-23",
    time: "09:00",
    desc: "급여 (주)원소프트",
    type: "in",
    amount: 3200000,
    balanceAfter: 2390360,
  },
  {
    id: "tx-3",
    accountId: "acc-2",
    accountNickname: "우리 SUPER주거래통장",
    date: "2026-08-21",
    time: "10:00",
    desc: "자동이체 - 적금",
    type: "out",
    amount: 500000,
    balanceAfter: 15200000,
  },
  {
    id: "tx-4",
    accountId: "acc-1",
    accountNickname: "우리 첫급여통장",
    date: "2026-08-20",
    time: "19:45",
    desc: "배달의민족",
    type: "out",
    amount: 24500,
    balanceAfter: 1890360,
  },
  {
    id: "tx-5",
    accountId: "acc-1",
    accountNickname: "우리 첫급여통장",
    date: "2026-08-18",
    time: "12:30",
    desc: "CU 강남역점",
    type: "out",
    amount: 4500,
    balanceAfter: 1914860,
  },
  {
    id: "tx-6",
    accountId: "acc-2",
    accountNickname: "우리 SUPER주거래통장",
    date: "2026-08-15",
    time: "11:00",
    desc: "이자 입금",
    type: "in",
    amount: 12500,
    balanceAfter: 15700000,
  },
  {
    id: "tx-7",
    accountId: "acc-3",
    accountNickname: "우리 청년도약계좌",
    date: "2026-08-10",
    time: "09:00",
    desc: "정기 적금 납입",
    type: "in",
    amount: 700000,
    balanceAfter: 5000000,
  },
];

// [가짜 예금주 사전]
// 오프라인 상태에서 이체할 계좌번호를 입력했을 때 예금주 실명 조회가 되는 것처럼 흉내 내기 위한 데이터입니다.
const mockOwners = {
  "1002123456789": "김민준",
  "1002987654321": "이서연",
  "1002111122223": "박지원",
  "1002333344445": "최종관",
};

// ====================================================================
// [2. 실제 API 호출 & 자동 더미 전환 함수들]
// ====================================================================

/**
 * ▶ ③ 화면이 서버에 "내 계좌 목록 좀 줘"라고 요청하는 함수예요.
 * 서버가 켜져 있으면 진짜 계좌 정보를, 꺼져 있으면 미리 준비한 가짜 데이터를 돌려줘서
 * 서버 상태와 상관없이 화면이 항상 정상적으로 보이게 해줘요.
 * 👉 설명 후 다시 src/pages/TransferPage.jsx 파일로 돌아가서 1~3단계 화면을 보여주세요. (④)
 *
 * 1. 전체 계좌 목록 가져오기 함수
 * 홈 화면이나 이체 화면에서 내 통장 목록들을 보여줄 때 호출합니다.
 */
export async function getAccounts() {
  try {
    // 💡 AbortController: 서버가 꺼져 있을 때 브라우저가 무한정 멈춰서 기다리는 것을 막아주는 "타이머 스위치"입니다.
    const controller = new AbortController();
    // 1.2초 동안 백엔드에서 대답이 없으면 네트워크 연결 시도를 강제로 취소(중단)합니다.
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    // 실제 백엔드 서버(localhost:4000/api/accounts)로 데이터를 달라고 요청(GET)합니다.
    const res = await fetch(`${BASE_URL}/api/accounts`, {
      credentials: "omit",        // 불필요한 쿠키 전송 방지
      signal: controller.signal,  // 1.2초 타이머와 연결
    });

    // 응답이 제시간에 잘 도착했으므로 타이머를 해제합니다.
    clearTimeout(timeoutId);

    // 서버가 404나 500 같은 에러 코드를 보내왔다면 강제로 아래 catch 블록으로 보냅니다.
    if (!res.ok) throw new Error("서버 응답 오류");

    // 서버가 보내준 진짜 JSON 계좌 목록 데이터를 반환합니다.
    return await res.json();
  } catch {
    // 💡 [Fallback 실행] 만약 4000번 서버가 꺼져 있거나 연결에 실패하면 이 부분이 실행됩니다.
    console.warn("⚠️ [4000번 서버 미연결] 계좌 더미 데이터를 화면에 표시합니다.");
    // 원본 데이터를 안전하게 보호하기 위해 복사본([...mockAccounts])을 만들어 돌려줍니다.
    return [...mockAccounts];
  }
}

/**
 * 2. 거래내역 목록 가져오기 함수
 * 거래내역 화면에서 특정 계좌만 보거나, 입금/출금만 필터링해서 볼 때 호출합니다.
 * @param {string} accountId - 보고 싶은 계좌의 ID (전체면 "ALL")
 * @param {string} type - "ALL"(전체), "in"(입금만), "out"(출금만)
 */
export async function getTransactions(accountId = "ALL", type = "ALL") {
  try {
    // 1.2초 타임아웃 타이머 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    // 백엔드 URL 뒤에 붙일 조건 주소(?accountId=acc-1&type=out)를 만듭니다.
    const queryParams = [];
    if (accountId !== "ALL") queryParams.push(`accountId=${accountId}`);
    if (type !== "ALL") queryParams.push(`type=${type}`);

    // 조건이 있으면 '?조건1&조건2' 형태로 만들고, 없으면 빈 문자열('')로 둡니다.
    const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

    // 백엔드 서버로 거래내역을 요청합니다.
    const res = await fetch(`${BASE_URL}/api/transactions${queryString}`, {
      credentials: "omit",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("서버 응답 오류");

    // 백엔드에서 조건에 맞게 걸러서 보내준 진짜 거래내역 데이터를 반환합니다.
    return await res.json();
  } catch {
    // 💡 [Fallback 실행] 서버가 꺼져 있을 때는 프론트엔드가 자체적으로 가짜 데이터를 걸러서(filter) 반환합니다.
    console.warn("⚠️ [4000번 서버 미연결] 거래내역 더미 데이터를 조건에 맞게 필터링합니다.");
    
    // 전체 더미 거래내역 복사
    let filtered = [...mockTransactions];

    // 사용자가 특정 계좌를 선택한 경우 -> 해당 계좌 번호 내역만 남김
    if (accountId !== "ALL") {
      filtered = filtered.filter((t) => t.accountId === accountId);
    }
    // 사용자가 입금이나 출금 탭을 누른 경우 -> 해당 타입(in 또는 out)만 남김
    if (type !== "ALL") {
      filtered = filtered.filter((t) => t.type === type);
    }

    // 조건에 맞게 걸러진 더미 거래내역 목록을 화면에 돌려줍니다.
    return filtered;
  }
}

/**
 * 3. 예금주 실명 조회 함수
 * 이체 화면에서 상대방 계좌번호를 적었을 때 "받는 사람 이름"을 자동으로 띄워주는 함수입니다.
 * @param {string} bank - 은행 이름 (예: "우리은행")
 * @param {string} accountNo - 사용자가 입력한 계좌번호
 */
export async function lookupAccountOwner(bank, accountNo) {
  try {
    // 하이픈(-)이나 띄어쓰기 등 불필요한 문자를 없애고 순수 '숫자'만 추출합니다.
    const cleanNo = accountNo.replace(/[^0-9]/g, "");

    // 1초 타임아웃 타이머 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    // 백엔드의 실명조회 라우터로 요청을 보냅니다.
    const res = await fetch(
      `${BASE_URL}/api/transfer/lookup?bank=${encodeURIComponent(bank)}&accountNo=${encodeURIComponent(cleanNo)}`,
      { credentials: "omit", signal: controller.signal }
    );
    clearTimeout(timeoutId);

    // 조회가 실패하거나 없는 계좌면 null 반환
    if (!res.ok) return null;

    const data = await res.json();
    // 백엔드가 찾아서 알려준 진짜 예금주 이름(ownerName)을 돌려줍니다.
    return data.ownerName || null;
  } catch {
    // 💡 [Fallback 실행] 서버가 꺼져 있을 때 작동하는 가짜 실명 조회
    const cleanNo = accountNo.replace(/[^0-9]/g, "");
    
    // 1. mockOwners 사전에 등록된 계좌번호면 그 이름을 돌려줍니다 (예: 1002333344445 -> 최종관)
    // 2. 사전에 없더라도 11자리 이상 입력하면 오류 없이 테스트할 수 있게 "테스트수취인"이라는 이름을 줍니다.
    return mockOwners[cleanNo] || (cleanNo.length >= 11 ? "테스트수취인" : null);
  }
}

/**
 * 4-1. 백엔드 서버 연결 상태 확인 함수
 * 헤더의 연동 표시등(초록불/빨간불)에서 4000번 서버가 살아있는지 가볍게 확인할 때 호출합니다.
 * @returns {Promise<boolean>} true면 서버 연결됨, false면 서버 미연결(더미 모드)
 */
export async function checkServerConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const res = await fetch(`${BASE_URL}/api/health`, {
      credentials: "omit",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * ▶ ⑧ 실제로 "이체해줘"라고 서버에 요청하는 함수예요. (발표 핵심 함수)
 * 서버가 켜져 있으면 진짜 서버(won-banking-api/server.js)로 요청을 보내서
 * 잔액을 깎고 거래내역을 만들고, 서버가 꺼져 있으면 화면에서 직접 흉내 내서
 * 잔액을 깎아요(오프라인 모드).
 * 👉 다음은 won-banking-api/server.js 파일의 "POST /api/transfers" 부분으로 이동하세요. (⑨)
 *
 * 4. 이체 실행 요청 함수
 * 이체 화면에서 '이체하기' 버튼을 눌렀을 때 실제로 돈을 보내는 함수입니다.
 * @param {Object} payload - { fromAccountId, toBank, toAccountNo, toOwnerName, amount }
 */
export async function postTransfer(payload) {
  try {
    // 이체는 중요한 작업이므로 조금 더 긴 2초 타임아웃을 설정합니다.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    // 백엔드 이체 API로 데이터(누가, 누구에게, 얼마를 보낼지)를 담아 POST 요청을 보냅니다.
    let res = await fetch(`${BASE_URL}/api/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), // 자바스크립트 객체를 텍스트 형태(JSON)로 변환
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // 팀원의 백엔드 라우터가 복수형(/transfers)이 아니라 단수형(/transfer)일 경우를 대비해 404면 한 번 더 재시도합니다.
    if (res.status === 404) {
      res = await fetch(`${BASE_URL}/api/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const result = await res.json().catch(() => ({ message: "응답 파싱 에러" }));
    
    // 잔액 부족 등으로 백엔드에서 거절했을 경우 에러를 발생시킵니다.
    if (!res.ok) throw new Error(result.message || "이체 처리에 실패했습니다.");

    // 이체 성공 결과 반환
    return result;
  } catch {
    // 💡 [Fallback 실행] 서버가 꺼져 있어도 화면상에서 진짜 이체된 것처럼 흉내 냅니다!
    console.warn("⚠️ [4000번 서버 미연결] 오프라인 가상 이체로 잔액 차감 및 내역을 추가합니다.");

    // 1. 내 가짜 계좌 중에서 돈을 출금할 계좌를 찾습니다.
    const sender = mockAccounts.find((a) => a.id === payload.fromAccountId);
    if (!sender) throw new Error("출금 계좌를 찾을 수 없습니다.");
    if (sender.balance < payload.amount) throw new Error("잔액이 부족합니다.");

    // 2. 가상으로 출금 계좌의 잔액을 깎습니다.
    sender.balance -= payload.amount;

    // 3. 현재 시간으로 가상의 새로운 거래내역 객체를 하나 만듭니다.
    const now = new Date();
    const newTx = {
      id: `tx-${Date.now()}`,       // 고유한 거래 번호 (현재 밀리초 시간값)
      accountId: sender.id,         // 돈을 보낸 계좌 ID
      accountNickname: sender.nickname,
      date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      desc: `${payload.toOwnerName || "이체"} (${payload.toBank})`, // 예: 김민준 (우리은행)
      type: "out",                  // 보낸 돈이므로 출금
      amount: payload.amount,       // 보낸 금액
      balanceAfter: sender.balance, // 돈 빠져나가고 남은 새 잔액
    };

    // 4. 새로 만든 거래내역을 맨 앞(0번 인덱스)에 추가해서 최신 거래로 바로 보이게 만듭니다.
    mockTransactions = [newTx, ...mockTransactions];

    // 이체가 성공했다는 가짜 완료 응답 객체를 돌려줍니다.
    return {
      success: true,
      message: "더미 가상 이체 완료",
      transfer: newTx,
    };
  }
}