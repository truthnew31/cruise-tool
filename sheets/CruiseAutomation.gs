// =====================================================
// 크루즈 상세페이지 자동화 - Google Apps Script
// =====================================================

// ⚠️ Vercel 배포 URL (끝에 / 없이)
const CRUISE_API = "https://YOUR_VERCEL_URL.vercel.app";

// 시트명
const SHEET_NAME = "상품 상세페이지";

// 기존 시트 컬럼 위치 (A=1, B=2, ...)
const COL = {
  PLACE        : 1,  // A: PLACE
  OFFER_ID     : 2,  // B: Offer ID
  PRODUCT_ID_C : 3,  // C: Product ID
  PRODUCT_NAME : 4,  // D: 상품명 (파싱 입력값)
  REQUESTER    : 5,  // E: 요청자
  LISTING_DATE : 6,  // F: 리스팅 날짜
  PRIORITY     : 7,  // G: 우선 검수
  STATUS       : 8,  // H: status
  PAGE_STATUS  : 9,  // I: 상세페이지 제작 여부
  PAGE_LINK    : 10, // J: 상세페이지 (편집 링크)
  NEEDS_REVIEW : 11, // K: 검수 필요 사항
  JPG_LINK     : 12, // L: JPG 다운로드 (빈 열 활용)
  //             13, // M: 상품 유형 (크루즈/투어) — 선택 열
  COMPLETE     : 14, // N: 검수 완료 여부
};

// D열 상품명에서 상품 유형 판단 (마지막줄이 영어선박명 패턴이면 크루즈)
function detectProductType(lines) {
  // M열에 명시된 경우 우선
  // 판단 기준: "크루즈" 키워드 or 선박명(영문+공백) 패턴
  var text = lines.join(' ').toLowerCase();
  if (text.includes('크루즈') || text.includes('cruise') || text.includes('선박') ||
      text.includes('ncl') || text.includes('msc') || text.includes('royal caribbean') ||
      text.includes('princess') || text.includes('celebrity')) {
    return 'cruise';
  }
  return 'tour';
}

// ── I열 드롭박스 무시하고 쓰기 ─────────────────────
function setPageStatus(sheet, row, value) {
  var cell = sheet.getRange(row, COL.PAGE_STATUS);
  cell.clearDataValidations();
  cell.setValue(value);
}

// ── 메뉴 추가 ──────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚢 크루즈 자동화")
    .addItem("📄 상세페이지 생성 (선택 행)", "generateSelected")
    .addSeparator()
    .addItem("✅ 검수 완료 처리 (선택 행)", "markComplete")
    .addItem("🔄 생성 결과 초기화 (선택 행)", "resetRow")
    .addSeparator()
    .addItem("💡 상품명 입력 형식 보기", "showFormatGuide")
    .addToUi();
}

// ── 상품명 입력 형식 안내 ───────────────────────────
function showFormatGuide() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    "📝 D열 상품명 입력 형식",
    "【크루즈 상품】\n" +
    "영문 노선명 (예: Alaska Cruise)\n" +
    "한글 노선명 (예: 알래스카 크루즈)\n" +
    "지역 (예: 알래스카)\n" +
    "출항년월 (예: 2026-07)\n" +
    "선사명 (예: Norwegian Cruise Line)\n" +
    "선박명 (예: Norwegian Bliss)\n\n" +
    "【일반 투어 상품】\n" +
    "상품명 (예: 스위스 융프라우 완전정복)\n" +
    "여행지/지역 (예: 스위스 취리히·인터라켄)\n" +
    "기간 (예: 7박 8일)\n\n" +
    "⚠️ 각 정보는 셀 내 줄바꿈(Alt+Enter)으로 구분",
    ui.ButtonSet.OK
  );
}

// ── D열 상품명 파싱 ─────────────────────────────────
// 상품명 형식 예시:
//   Miami to Seattle
//   마이애미 출발, 시애틀 도착
//   카리브해
//   2026-04
//   큐나드 크루즈
//   Queen Elizabeth
function parseProductName(text) {
  var lines = String(text).split('\n')
    .map(function(l) { return l.trim(); })
    .filter(function(l) { return l.length > 0; });

  var departure    = '';
  var departureIdx = -1;
  var region       = '';
  var shippingLine = '';
  var shipName     = '';

  // YYYY-MM 패턴으로 출항년월 찾기
  for (var i = 0; i < lines.length; i++) {
    if (/^\d{4}-\d{2}/.test(lines[i])) {
      departure    = lines[i];
      departureIdx = i;
      break;
    }
  }

  // 선박명 = 마지막 줄, 선사 = 마지막에서 2번째 줄
  shipName     = lines[lines.length - 1] || '';
  shippingLine = lines.length >= 2 ? lines[lines.length - 2] : '';

  // 노선/지역 = 출항년월 바로 앞 줄 (없으면 3번째 줄)
  if (departureIdx > 0) {
    region = lines[departureIdx - 1];
  } else if (lines.length >= 3) {
    region = lines[2];
  } else {
    region = lines[1] || '';
  }

  return {
    shippingLine : shippingLine,
    shipName     : shipName,
    region       : region,
    departure    : departure,
  };
}

// ── 상세페이지 생성 ────────────────────────────────
function generateSelected() {
  var ui    = SpreadsheetApp.getUi();
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  var row   = sheet.getActiveRange().getRow();

  if (row <= 1) {
    ui.alert("헤더 행은 선택할 수 없습니다. 데이터 행을 선택해주세요.");
    return;
  }

  // D열 상품명 읽기
  var productNameRaw = sheet.getRange(row, COL.PRODUCT_NAME).getValue();
  if (!productNameRaw) {
    ui.alert("D열 상품명이 비어있습니다. 상품명을 입력해주세요.");
    return;
  }

  // M열(13번)에 상품 유형 명시 여부 확인, 없으면 자동 감지
  var typeCellVal = String(sheet.getRange(row, 13).getValue()).trim();
  var lines = String(productNameRaw).split('\n')
    .map(function(l) { return l.trim(); })
    .filter(function(l) { return l.length > 0; });

  var productType;
  if (typeCellVal.includes('투어') || typeCellVal.toLowerCase().includes('tour')) {
    productType = 'tour';
  } else if (typeCellVal.includes('크루즈') || typeCellVal.toLowerCase().includes('cruise')) {
    productType = 'cruise';
  } else {
    productType = detectProductType(lines);
  }

  var parsed = parseProductName(productNameRaw);
  var confirmMsg, apiPath, editUrl, outputUrl;

  if (productType === 'cruise') {
    // 크루즈: 선사/선박명/노선 파싱
    if (!parsed.shippingLine || !parsed.shipName || !parsed.region) {
      ui.alert("상품명에서 크루즈 정보(선사·선박명·노선)를 파싱할 수 없습니다.\n형식을 확인해주세요.");
      return;
    }
    confirmMsg = "🚢 크루즈 상품\n\n선사: " + parsed.shippingLine
      + "\n선박명: " + parsed.shipName
      + "\n노선: " + parsed.region
      + "\n출항: " + (parsed.departure || "미입력");
    apiPath = "/api/generate-all?shippingLine=" + encodeURIComponent(parsed.shippingLine)
      + "&shipName="  + encodeURIComponent(parsed.shipName)
      + "&region="    + encodeURIComponent(parsed.region)
      + "&departure=" + encodeURIComponent(parsed.departure)
      + "&save=true";
  } else {
    // 투어: 마지막=상품명, 끝에서2번=지역, 끝에서3번=기간
    var tName     = lines[lines.length - 1] || '';
    var tRegion   = lines.length >= 2 ? lines[lines.length - 2] : '';
    var tDuration = lines.length >= 3 ? lines[lines.length - 3] : '';
    parsed.tourProductName = tName;
    parsed.tourRegion      = tRegion;
    parsed.tourDuration    = tDuration;
    confirmMsg = "✈️ 투어 상품\n\n상품명: " + tName
      + "\n지역: " + tRegion
      + "\n기간: " + tDuration;
    apiPath = "/api/generate-tour?productName=" + encodeURIComponent(tName)
      + "&region="   + encodeURIComponent(tRegion)
      + "&duration=" + encodeURIComponent(tDuration)
      + "&save=true";
  }

  var confirm = ui.alert(
    "상세페이지 생성 확인",
    confirmMsg + "\n\n생성하시겠습니까? (약 1~2분 소요)",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // 상태 업데이트
  setPageStatus(sheet, row, "검수중");
  sheet.getRange(row, COL.NEEDS_REVIEW).setValue("생성중...").setBackground("#E8F4FD");
  sheet.getRange(row, COL.PAGE_LINK).setValue("");
  sheet.getRange(row, COL.JPG_LINK).setValue("");
  SpreadsheetApp.flush();

  try {
    var response = UrlFetchApp.fetch(CRUISE_API + apiPath, { muteHttpExceptions: true });
    var result   = JSON.parse(response.getContentText());

    if (result.ok && result.productId) {
      var productId = result.productId;

      if (productType === 'cruise') {
        editUrl   = CRUISE_API + "/edit/" + productId
          + "?fromDB=1"
          + "&shippingLine=" + encodeURIComponent(parsed.shippingLine)
          + "&shipName="     + encodeURIComponent(parsed.shipName)
          + "&region="       + encodeURIComponent(parsed.region);
        outputUrl = CRUISE_API + "/output/" + productId
          + "?shippingLine=" + encodeURIComponent(parsed.shippingLine)
          + "&shipName="     + encodeURIComponent(parsed.shipName)
          + "&region="       + encodeURIComponent(parsed.region);
      } else {
        editUrl   = CRUISE_API + "/edit-tour/" + productId
          + "?fromDB=1"
          + "&productName=" + encodeURIComponent(parsed.tourProductName)
          + "&region="      + encodeURIComponent(parsed.tourRegion)
          + "&duration="    + encodeURIComponent(parsed.tourDuration);
        outputUrl = CRUISE_API + "/output-tour/" + productId
          + "?productName=" + encodeURIComponent(parsed.tourProductName)
          + "&region="      + encodeURIComponent(parsed.tourRegion);
      }

      setPageStatus(sheet, row, "초안 완성");

      var needsReview = (result.needsReview && result.needsReview.length > 0)
        ? result.needsReview.join("\n") : "없음";
      sheet.getRange(row, COL.NEEDS_REVIEW).setValue(needsReview);
      sheet.getRange(row, COL.NEEDS_REVIEW).setBackground(
        result.needsReview && result.needsReview.length > 0 ? "#FFF3CD" : "#D4EDDA"
      );
      sheet.getRange(row, COL.PAGE_LINK).setFormula('=HYPERLINK("' + editUrl + '","✏️ 편집하기")');
      sheet.getRange(row, COL.JPG_LINK).setFormula('=HYPERLINK("' + outputUrl + '","🖼️ JPG 다운로드")');

      ui.alert("✅ 생성 완료! (" + (productType === 'cruise' ? '🚢 크루즈' : '✈️ 투어') + ")\n\n검수 필요 사항:\n" + needsReview);

    } else {
      var errMsg = result.error || "알 수 없는 오류";
      setPageStatus(sheet, row, "HOLD");
      sheet.getRange(row, COL.NEEDS_REVIEW).setValue("오류: " + errMsg).setBackground("#F8D7DA");
      ui.alert("생성 실패:\n" + errMsg);
    }

  } catch(e) {
    setPageStatus(sheet, row, "HOLD");
    sheet.getRange(row, COL.NEEDS_REVIEW).setValue("오류: " + e.message).setBackground("#F8D7DA");
    ui.alert("오류 발생:\n" + e.message);
  }
}

// ── 검수 완료 처리 ─────────────────────────────────
function markComplete() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  var row   = sheet.getActiveRange().getRow();
  if (row <= 1) return;

  var pageStatus = String(sheet.getRange(row, COL.PAGE_STATUS).getValue());
  if (!pageStatus.includes("생성완료")) {
    SpreadsheetApp.getUi().alert("상세페이지가 생성된 행만 검수 완료 처리할 수 있습니다.");
    return;
  }

  setPageStatus(sheet, row, "완성");
  sheet.getRange(row, COL.COMPLETE).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  );
  sheet.getRange(row, COL.NEEDS_REVIEW).setBackground("#D4EDDA");
}

// ── 행 초기화 ──────────────────────────────────────
function resetRow() {
  var ui    = SpreadsheetApp.getUi();
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  var row   = sheet.getActiveRange().getRow();
  if (row <= 1) return;

  if (ui.alert("선택 행의 생성 결과를 초기화하시겠습니까?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  [COL.PAGE_STATUS, COL.NEEDS_REVIEW, COL.PAGE_LINK, COL.JPG_LINK, COL.COMPLETE].forEach(function(c) {
    sheet.getRange(row, c).setValue("").setBackground(null);
  });
}
