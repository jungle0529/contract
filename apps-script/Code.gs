/**
 * 계약 단계 체크 대시보드용 시트 리더 (Apps Script 웹앱)
 *
 * gviz CSV 로는 하이퍼링크의 실제 URL을 읽을 수 없어서, 이 스크립트가
 * 매출/매입 데이터(표시값)와 함께 각 탭 "계약기안" 컬럼의 링크 URL을
 * 추출해 JSON 으로 제공한다.
 *
 * 반환: { values, draftLinks, buyValues, buyDraftLinks }
 *   - values/draftLinks      : 매출(첫 번째 시트)
 *   - buyValues/buyDraftLinks : 매입(gid=1237292122)
 *
 * 배포(소유자 1회):
 *   1) 구글 시트 → 확장 프로그램 → Apps Script
 *   2) 이 파일 내용을 붙여넣고 저장
 *   3) 배포 → 새 배포 → 유형: 웹 앱, 실행: 나, 액세스: 모든 사용자(Anyone)
 *   ※ 이미 배포돼 있으면: 배포 → 배포 관리 → (연필)편집 → 버전: 새 버전 → 배포
 *      (그래야 매입 추가분이 반영됨. /exec URL은 그대로 유지된다)
 */

var SHEET_ID = '1AHtE3d2-2eAy7sq2g6-L1VyoU7kt-h68Qgtv3cNDcLk';
var BUY_GID = 1237292122;
var EXCLUDE_HEADER = ['id', '구분', '계약코드', '단계', '날짜', '금액', '거래처', '갱신시각'];

function doGet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var main = readSheet(ss.getSheets()[0]); // gid=0 = 매출
  var buySheet = getSheetByGid(ss, BUY_GID);
  var buy = buySheet ? readSheet(buySheet) : { values: [], draftLinks: [] };

  var out = {
    values: main.values,
    draftLinks: main.draftLinks,
    buyValues: buy.values,
    buyDraftLinks: buy.draftLinks,
    excludedIds: readExcludedIds(ss), // 제외 탭(공유) → id 목록
  };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 정산 제외 토글 기록 (브라우저에서 text/plain POST)
function doPost(e) {
  var resp = { ok: false };
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = getExcludeSheet(ss, true);
    var id = String(body.id || '');

    if (body.action === 'clear') {
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    } else if (body.action === 'add' && id) {
      if (findExcludeRow(sh, id) < 0) {
        var m = body.meta || {};
        sh.appendRow([id, m.kind || '', m.code || '', m.label || '', m.date || '', m.amount || '', m.partner || '', new Date()]);
      }
    } else if (body.action === 'remove' && id) {
      var row = findExcludeRow(sh, id);
      if (row >= 0) sh.deleteRow(row + 1);
    }
    resp.ok = true;
  } catch (err) {
    resp.error = String(err);
  }
  return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
}

// 이름에 '제외'가 든 시트 (없으면 create=true 시 생성)
function getExcludeSheet(ss, create) {
  var sh = ss.getSheets();
  for (var i = 0; i < sh.length; i++) {
    if (sh[i].getName().indexOf('제외') >= 0) return sh[i];
  }
  if (create) {
    var ns = ss.insertSheet('제외');
    ns.appendRow(EXCLUDE_HEADER);
    return ns;
  }
  return null;
}

function readExcludedIds(ss) {
  var sh = getExcludeSheet(ss, false);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var ids = [];
  for (var i = 0; i < vals.length; i++) {
    var id = String(vals[i][0] || '').trim();
    if (id) ids.push(id);
  }
  return ids;
}

// id가 있는 행의 0-based data index (헤더 제외) → 실제 행번호 = +1 후 +1
function findExcludeRow(sh, id) {
  if (sh.getLastRow() < 2) return -1;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === id) return i + 1; // 헤더가 1행이므로 데이터 i는 시트행 i+2 → deleteRow엔 +1 보정 위해 i+1 반환
  }
  return -1;
}

function getSheetByGid(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return null;
}

// 한 시트 → { values(표시값 2D), draftLinks(계약기안 링크 URL, values와 행정렬) }
function readSheet(sh) {
  var range = sh.getDataRange();
  var values = range.getDisplayValues();

  // 헤더 행(코드/계약 류 포함) + 계약기안 컬럼 찾기
  var headerRow = 0;
  for (var i = 0; i < Math.min(values.length, 15); i++) {
    if (values[i].some(function (c) {
      var s = String(c).replace(/\s+/g, '');
      return s.indexOf('견적코드') >= 0 || s.indexOf('매입코드') >= 0;
    })) { headerRow = i; break; }
  }
  var hdr = values[headerRow] || [];
  var draftCol = -1;
  for (var c = 0; c < hdr.length; c++) {
    if (String(hdr[c]).replace(/\s+/g, '').indexOf('계약기안') >= 0) { draftCol = c; break; }
  }

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
  return { values: values, draftLinks: draftLinks };
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
