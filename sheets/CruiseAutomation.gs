// =====================================================
// 크루즈 상세페이지 자동화 - Google Apps Script
// 시트에 붙여넣고 배포 URL을 설정하세요
// =====================================================

// ⚠️ 여기에 Vercel 배포 URL을 입력하세요 (끝에 / 없이)
const CRUISE_API = "https://YOUR_VERCEL_URL.vercel.app";

// 시트명 (실제 시트 탭 이름에 맞게 수정)
const SHEET_NAME = "크루즈 상세페이지";

// 컬럼 위치 (A=1, B=2, ...)
const COL = {
  SHIPPING_LINE : 1,  // A: 선사
  SHIP_NAME     : 2,  // B: 선박명
  REGION        : 3,  // C: 노선/지역
  DEPARTURE     : 4,  // D: 출항년월
  REQUESTER     : 5,  // E: 요청자
  STATUS        : 6,  // F: 상태
  PRODUCT_ID    : 7,  // G: Product ID (숨김 가능)
  NEEDS_REVIEW  : 8,  // H: 검수 필요 사항
  EDIT_LINK     : 9,  // I: 편집 페이지
  OUTPUT_LINK   : 10, // J: JPG 다운로드
  COMPLETE_DATE : 11, // K: 검수 완료일
};

// ── 메뉴 추가 ──────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚢 크루즈 자동화")
    .addItem("📄 상세페이지 생성 (선택 행)", "generateSelected")
    .addSeparator()
    .addItem("✅ 검수 완료 처리 (선택 행)", "markComplete")
    .addItem("🔄 상태 초기화 (선택 행)", "resetRow")
    .addSeparator()
    .addItem("⚙️ 헤더 초기 설정 (최초 1회)", "setupHeaders")
    .addToUi();
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

  var shippingLine = String(sheet.getRange(row, COL.SHIPPING_LINE).getValue()).trim();
  var shipName     = String(sheet.getRange(row, COL.SHIP_NAME).getValue()).trim();
  var region       = String(sheet.getRange(row, COL.REGION).getValue()).trim();
  var departure    = String(sheet.getRange(row, COL.DEPARTURE).getValue()).trim();

  if (!shippingLine || !shipName || !region) {
    ui.alert("선사(A), 선박명(B), 노선(C)을 입력한 후 다시 시도해주세요.");
    return;
  }

  var confirm = ui.alert(
    "상세페이지 생성",
    shippingLine + " / " + shipName + " / " + region + "\n\n생성하시겠습니까? (1~2분 소요)",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // 상태 업데이트
  sheet.getRange(row, COL.STATUS).setValue("⏳ 생성중...");
  sheet.getRange(row, COL.NEEDS_REVIEW).setValue("").setBackground(null);
  sheet.getRange(row, COL.EDIT_LINK).setValue("");
  sheet.getRange(row, COL.OUTPUT_LINK).setValue("");
  SpreadsheetApp.flush();

  try {
    var params = "shippingLine=" + encodeURIComponent(shippingLine)
               + "&shipName="    + encodeURIComponent(shipName)
               + "&region="      + encodeURIComponent(region)
               + "&departure="   + encodeURIComponent(departure)
               + "&save=true";

    var response = UrlFetchApp.fetch(CRUISE_API + "/api/generate-all?" + params, {
      muteHttpExceptions: true,
      followRedirects: true,
    });

    var result = JSON.parse(response.getContentText());

    if (result.ok && result.productId) {
      var productId = result.productId;
      var editUrl   = CRUISE_API + "/edit/"   + productId;
      var outputUrl = CRUISE_API + "/output/" + productId;

      sheet.getRange(row, COL.STATUS).setValue("✅ 생성완료");
      sheet.getRange(row, COL.PRODUCT_ID).setValue(productId);

      // 검수 필요 사항
      var needsReview = (result.needsReview && result.needsReview.length > 0)
        ? result.needsReview.join("\n")
        : "없음";
      sheet.getRange(row, COL.NEEDS_REVIEW).setValue(needsReview);
      if (result.needsReview && result.needsReview.length > 0) {
        sheet.getRange(row, COL.NEEDS_REVIEW).setBackground("#FFF3CD"); // 노란색: 검수 필요
      } else {
        sheet.getRange(row, COL.NEEDS_REVIEW).setBackground("#D4EDDA"); // 초록색: 문제 없음
      }

      // 링크 셀
      sheet.getRange(row, COL.EDIT_LINK).setFormula('=HYPERLINK("' + editUrl + '","✏️ 편집하기")');
      sheet.getRange(row, COL.OUTPUT_LINK).setFormula('=HYPERLINK("' + outputUrl + '","🖼️ JPG 다운로드")');

      ui.alert("✅ 생성 완료!\n\n검수 필요 사항:\n" + needsReview);
    } else {
      var errMsg = result.error || "알 수 없는 오류";
      sheet.getRange(row, COL.STATUS).setValue("❌ 오류");
      sheet.getRange(row, COL.NEEDS_REVIEW).setValue("오류: " + errMsg).setBackground("#F8D7DA");
      ui.alert("생성 실패:\n" + errMsg);
    }
  } catch(e) {
    sheet.getRange(row, COL.STATUS).setValue("❌ 오류");
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

  var status = String(sheet.getRange(row, COL.STATUS).getValue());
  if (!status.includes("생성완료") && !status.includes("검수")) {
    SpreadsheetApp.getUi().alert("상세페이지가 생성된 행만 검수 완료 처리할 수 있습니다.");
    return;
  }

  sheet.getRange(row, COL.STATUS).setValue("🎉 검수완료");
  sheet.getRange(row, COL.COMPLETE_DATE).setValue(
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

  var confirm = ui.alert("선택 행의 생성 결과를 초기화하시겠습니까?", ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  [COL.STATUS, COL.PRODUCT_ID, COL.NEEDS_REVIEW, COL.EDIT_LINK, COL.OUTPUT_LINK, COL.COMPLETE_DATE].forEach(function(c) {
    sheet.getRange(row, c).setValue("").setBackground(null);
  });
}

// ── 헤더 자동 설정 (최초 1회) ──────────────────────
function setupHeaders() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  var headers = [
    "선사", "선박명", "노선/지역", "출항년월", "요청자",
    "상태", "Product ID", "검수 필요 사항", "편집 페이지", "JPG 다운로드", "검수 완료일"
  ];
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#1E3A5F")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");

  var widths = [160, 150, 120, 100, 80, 110, 80, 280, 100, 110, 100];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert("헤더 설정 완료! 이제 A~E열에 데이터를 입력하고 메뉴에서 생성을 실행하세요.");
}
