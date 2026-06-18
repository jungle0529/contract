/**
 * 계약 단계 체크 대시보드용 시트 리더 (Apps Script 웹앱)
 *
 * gviz CSV 로는 하이퍼링크의 실제 URL을 읽을 수 없어서, 이 스크립트가
 * 시트 데이터(표시값)와 함께 "계약기안" 컬럼의 링크 URL을 추출해 JSON 으로 제공한다.
 *
 * 배포 방법 (시트 소유자가 1회):
 *   1) 구글 시트 → 확장 프로그램 → Apps Script
 *   2) 이 파일 내용을 붙여넣고 저장
 *   3) 배포 → 새 배포 → 유형: 웹 앱
 *      - 실행: 나(소유자)
 *      - 액세스 권한: 모든 사용자(Anyone)
 *   4) 배포 후 나오는 "웹 앱 URL"(/exec 로 끝남)을 프런트엔드에 전달
 *      (config.js 의 APPS_SCRIPT_URL 또는 페이지 URL ?api=<웹앱URL>)
 *
 * 시트 구조가 바뀌면(계약기안 컬럼명/위치) 헤더명으로 자동으로 다시 찾는다.
 */

var SHEET_ID = '1AHtE3d2-2eAy7sq2g6-L1VyoU7kt-h68Qgtv3cNDcLk';

function doGet() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0]; // gid=0 = 첫 번째 시트
  var range = sh.getDataRange();
  var values = range.getDisplayValues();

  // 헤더 행(견적코드 포함) + 계약기안 컬럼 찾기
  var headerRow = 0;
  for (var i = 0; i < Math.min(values.length, 15); i++) {
    if (values[i].some(function (c) { return String(c).replace(/\s+/g, '').indexOf('견적코드') >= 0; })) {
      headerRow = i;
      break;
    }
  }
  var hdr = values[headerRow] || [];
  var draftCol = -1;
  for (var c = 0; c < hdr.length; c++) {
    if (String(hdr[c]).replace(/\s+/g, '').indexOf('계약기안') >= 0) { draftCol = c; break; }
  }

  // 계약기안 컬럼의 링크 URL (행 정렬은 values 와 동일)
  var draftLinks = values.map(function () { return ''; });
  if (draftCol >= 0) {
    var n = range.getNumRows();
    var colRange = sh.getRange(range.getRow(), range.getColumn() + draftCol, n, 1);
    var rich = colRange.getRichTextValues();
    var formulas = colRange.getFormulas();
    for (var r = 0; r < n; r++) {
      draftLinks[r] = extractUrl(rich[r][0], formulas[r][0]);
    }
  }

  var out = { values: values, draftLinks: draftLinks };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 리치텍스트 링크 또는 =HYPERLINK("url",...) 수식에서 URL 추출
function extractUrl(rich, formula) {
  if (formula) {
    var m = String(formula).match(/HYPERLINK\(\s*"([^"]+)"/i);
    if (m) return m[1];
  }
  if (rich) {
    var u = rich.getLinkUrl();
    if (u) return u;
    var runs = rich.getRuns();
    for (var k = 0; k < runs.length; k++) {
      var ru = runs[k].getLinkUrl();
      if (ru) return ru;
    }
  }
  return '';
}
