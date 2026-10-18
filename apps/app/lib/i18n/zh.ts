/**
 * 中文翻译词典 — 默认语言 (DEFAULT locale).
 *
 * This is the source of truth for the key set and is bundled with the app (it
 * is the fallback, so it must always be present). Other locales (e.g. en) are
 * lazy-loaded on demand and are typed as `Partial<Messages>` so a missing key
 * transparently falls back to Chinese.
 */
export const zh = {
  // Language toggle
  'lang.toggle': '切换语言',
  'lang.en': 'English',
  'lang.zh': '中文',

  // Common / shared
  'common.appName': '开卷角',
  'common.signOut': '退出登录',
  'common.installApp': '安装应用',
  'common.signedInAs': '已登录：{name}',
  'common.openMenu': '打开菜单',
  'common.closeMenu': '关闭菜单',

  // Theme toggle
  'theme.toLight': '切换到浅色模式',
  'theme.toDark': '切换到深色模式',
  'theme.light': '浅色模式',
  'theme.dark': '深色模式',

  // View switcher
  'view.system': '系统视图',
  'view.admin': '管理视图',
  'view.reader': '读者视图',
  'view.switchTo': '切换到{view}',
  'view.toSystem': '→ 系统视图',
  'view.toAdmin': '→ 管理视图',
  'view.toReader': '→ 读者视图',

  // Navigation
  'nav.tenants': '租户',
  'nav.catalog': '书目',
  'nav.members': '成员',
  'nav.overdue': '逾期',
  'nav.settings': '设置',
  'nav.feedback': '反馈',
  'nav.import': '导入',
  'nav.myBooks': '我的借阅',
  'nav.scan': '扫码',

  // Login page
  'login.title': '欢迎回来',
  'login.subtitle': '登录到你的图书馆',
  'login.email': '邮箱',
  'login.password': '密码',
  'login.signIn': '登录',
  'login.signingIn': '登录中…',
  'login.invalid': '邮箱或密码不匹配，请重试。',
  'login.demoHint': '试用演示账号 — 点击角色即可自动填写',
  'login.role.superAdmin': '超级管理员',
  'login.role.libraryAdmin': '图书馆管理员',
  'login.role.libraryReader': '图书馆读者',

  // My Books (reader)
  'myBooks.title': '我的借阅',
  'myBooks.scanToBorrow': '扫码借书',
  'myBooks.browseCatalog': '浏览书目',
  'myBooks.summary.borrowed': '已借 {count} 本',
  'myBooks.summary.overdue': '{count} 本逾期',
  'myBooks.summary.dueSoon': '{count} 本即将到期',
  'myBooks.empty.title': '还没有借阅任何书籍',
  'myBooks.empty.description': '扫描书籍条形码即可借阅，或浏览书目。',
  'myBooks.byAuthor': '作者：{author}',
  'myBooks.noCover': '暂无封面',
  'myBooks.borrowedOn': '借阅于 {date}',
  'myBooks.dueOn': '应还于 {date}',
  'myBooks.return': '归还',
  'myBooks.returning': '归还中…',
  'myBooks.returned': '已归还 — 谢谢！',
  // Due-date badges (relative). `{count}` is the number of days.
  'myBooks.due.overdueOne': '逾期 1 天',
  'myBooks.due.overdueMany': '逾期 {count} 天',
  'myBooks.due.today': '今天到期',
  'myBooks.due.inOne': '还有 1 天到期',
  'myBooks.due.inMany': '还有 {count} 天到期',
} as const

/**
 * The canonical message key set. Keys come from the bundled default (zh);
 * values are plain `string` so other locales can supply any translation.
 */
export type MessageKey = keyof typeof zh
export type Messages = Record<MessageKey, string>
