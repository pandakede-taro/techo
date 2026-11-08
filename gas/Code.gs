/* iPad手帳に予定を渡す係（読むだけ）。
   Google カレンダーの予定を JSON で返す。カレンダーを変更する権限は持たない。
   デプロイ先のアドレスを知っている人は予定を読めるので、アドレスは iPad の中だけに置く。 */
function doGet() {
  var now = new Date();
  var DAY = 86400000;
  var from = new Date(now.getTime() - 60 * DAY);
  var to = new Date(now.getTime() + 400 * DAY);
  var tz = Session.getScriptTimeZone();
  var out = { v: 1, at: now.getTime(), cals: [], events: [] };

  CalendarApp.getAllCalendars().forEach(function (cal) {
    if (cal.isHidden()) return;
    var c = out.cals.length;
    out.cals.push({ n: cal.getName(), c: cal.getColor() });
    cal.getEvents(from, to).forEach(function (ev) {
      if (ev.isAllDayEvent()) {
        out.events.push({
          c: c, t: ev.getTitle(), a: 1,
          s: Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd'),
          e: Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd')
        });
      } else {
        out.events.push({ c: c, t: ev.getTitle(), s: ev.getStartTime().getTime(), e: ev.getEndTime().getTime() });
      }
    });
  });

  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
