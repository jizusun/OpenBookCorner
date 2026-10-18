import type { Messages } from './zh'

/**
 * English dictionary. LAZY-LOADED: this module is only fetched via a dynamic
 * `import()` when the user switches to English, so default (Chinese) users
 * never download it. Typed as `Partial<Messages>` — any missing key falls back
 * to Chinese automatically.
 *
 * This file is the default export so the loader can `import('./en').then(m => m.default)`.
 */
const en: Partial<Messages> = {
  // Language toggle
  'lang.toggle': 'Switch language',
  'lang.en': 'English',
  'lang.zh': '中文',

  // Common / shared
  'common.appName': 'OpenBookCorner',
  'common.signOut': 'Sign out',
  'common.installApp': 'Install app',
  'common.signedInAs': 'Signed in as {name}',
  'common.openMenu': 'Open menu',
  'common.closeMenu': 'Close menu',

  // Theme toggle
  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',
  'theme.light': 'Light mode',
  'theme.dark': 'Dark mode',

  // View switcher
  'view.system': 'System view',
  'view.admin': 'Admin view',
  'view.reader': 'Reader view',
  'view.switchTo': 'Switch to {view} view',
  'view.toSystem': '→ System view',
  'view.toAdmin': '→ Admin view',
  'view.toReader': '→ Reader view',

  // Navigation
  'nav.tenants': 'Tenants',
  'nav.catalog': 'Catalog',
  'nav.members': 'Members',
  'nav.overdue': 'Overdue',
  'nav.settings': 'Settings',
  'nav.feedback': 'Feedback',
  'nav.import': 'Import',
  'nav.myBooks': 'My Books',
  'nav.scan': 'Scan',

  // Login page
  'login.title': 'Welcome back',
  'login.subtitle': 'Sign in to your library',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': 'Signing in…',
  'login.invalid': 'That email or password doesn\u2019t match. Please try again.',
  'login.demoHint': 'Try a demo account — tap a role to fill it in',
  'login.role.superAdmin': 'Super Admin',
  'login.role.libraryAdmin': 'Library Admin',
  'login.role.libraryReader': 'Library Reader',

  // My Books (reader)
  'myBooks.title': 'My Books',
  'myBooks.scanToBorrow': 'Scan to borrow',
  'myBooks.browseCatalog': 'Browse catalog',
  'myBooks.summary.borrowed': '{count} borrowed',
  'myBooks.summary.overdue': '{count} overdue',
  'myBooks.summary.dueSoon': '{count} due soon',
  'myBooks.empty.title': 'No books borrowed yet',
  'myBooks.empty.description': 'Scan a book\u2019s barcode to borrow it, or browse the catalog.',
  'myBooks.byAuthor': 'by {author}',
  'myBooks.noCover': 'No cover',
  'myBooks.borrowedOn': 'Borrowed {date}',
  'myBooks.dueOn': 'Due {date}',
  'myBooks.return': 'Return',
  'myBooks.returning': 'Returning…',
  'myBooks.returned': 'Returned — thanks!',
  // Due-date badges (relative). `{count}` is the number of days.
  'myBooks.due.overdueOne': 'Overdue by 1 day',
  'myBooks.due.overdueMany': 'Overdue by {count} days',
  'myBooks.due.today': 'Due today',
  'myBooks.due.inOne': 'Due in 1 day',
  'myBooks.due.inMany': 'Due in {count} days',
}

export default en
