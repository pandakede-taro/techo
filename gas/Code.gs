/* iPad手帳に予定と「やること」を渡す係。
   doGet ＝ Google カレンダーの予定（題・日時・説明欄）と、預かっている「やること」を JSON で返す。カレンダーを変更する権限は持たない。
   doPost＝ Mac の係（tecyo_todo_push.py）から「やること」の一覧を預かる。合言葉が合うときだけ受け取る。
   デプロイ先のアドレスを知っている人は予定とやることを読めるので、アドレスは iPad の中と Mac の設定ファイルだけに置く。 */
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
      var item;
      if (ev.isAllDayEvent()) {
        item = {
          c: c, t: ev.getTitle(), a: 1,
          s: Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd'),
          e: Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd')
        };
      } else {
        item = { c: c, t: ev.getTitle(), s: ev.getStartTime().getTime(), e: ev.getEndTime().getTime() };
      }
      var d = ev.getDescription();
      if (d) item.d = d.slice(0, 4000);
      out.events.push(item);
    });
  });

  var todo = readTodo_();
  if (todo) out.todo = todo;

  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* 預かっている「やること」を読む。無ければ null */
function readTodo_() {
  try {
    var all = PropertiesService.getScriptProperties().getProperties();
    var n = Number(all.TODO_N || 0);
    if (!n) return null;
    var text = '';
    for (var i = 0; i < n; i++) text += all['TODO_' + i] || '';
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

/* Mac の係から「やること」を預かる。本文＝{key, items:[{t,due,who,ev,done}]}
   合言葉は、最初に届いたものの指紋（SHA-256）を覚え、以後はそれと合うものだけ受け取る。 */
function doPost(e) {
  var res = { ok: false };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    var key = String(body.key || '');
    if (key.length < 32) throw new Error('key');
    var props = PropertiesService.getScriptProperties();
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key, Utilities.Charset.UTF_8));
    var saved = props.getProperty('TODO_KEY_HASH');
    if (!saved) props.setProperty('TODO_KEY_HASH', hash);
    else if (saved !== hash) throw new Error('key');

    if (!Array.isArray(body.items) || body.items.length > 400) throw new Error('items');
    var clean = [];
    body.items.forEach(function (it) {
      if (!it || typeof it.t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(it.due)) return;
      clean.push({
        t: it.t.slice(0, 160), due: it.due,
        who: String(it.who || '').slice(0, 12), ev: String(it.ev || '').slice(0, 120),
        done: it.done ? 1 : 0
      });
    });

    var text = JSON.stringify({ at: Date.now(), items: clean });
    var SIZE = 2000, next = {}, n = 0;
    for (var i = 0; i < text.length; i += SIZE) next['TODO_' + (n++)] = text.slice(i, i + SIZE);
    next.TODO_N = String(n);
    var old = Number(props.getProperty('TODO_N') || 0);
    props.setProperties(next);
    for (var j = n; j < old; j++) props.deleteProperty('TODO_' + j);
    res = { ok: true, n: clean.length };
  } catch (err) {
    res.error = String((err && err.message) || err);
  } finally {
    try { lock.releaseLock(); } catch (err2) {}
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
