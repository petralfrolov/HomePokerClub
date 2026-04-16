/**
 * Все UI-строки фронтенда.
 * Новые строки следует добавлять сюда, а не хардкодить в компонентах.
 */
export const S = {
  // === App ===
  appTitle: '♠ Home Poker Club',
  kickedOverlay: 'КИКНУТ',

  // === Lobby ===
  lobbyTitle: 'Лобби',
  nicknamePlaceholder: 'Ваш никнейм',
  enter: 'Войти',
  newNickPlaceholder: 'Новый ник',
  changeNickTooltip: 'Нажмите, чтобы изменить ник',
  createTableBtn: '+ Создать стол',
  loading: 'Загрузка...',
  noTables: 'Нет доступных столов. Создайте первый!',
  cash: 'Кэш',
  tournament: 'Турнир',
  blindsLabel: 'Блайнды',
  playersLabel: 'Игроки',
  statusWaiting: 'Ожидание',
  statusRunning: 'Идёт игра',
  statusFinished: 'Завершён',
  deleteTable: '🗑 Удалить',
  kickedMessage: (cashout: number) => `Вы были кикнуты со стола. Кэшаут: ${cashout}`,

  // === Lobby — AFK ===
  atTableBadge: '🎮 Вы за этим столом',
  chipsLabel: 'Фишки',
  returnToTable: 'Вернуться за стол',
  yourChips: 'Ваши фишки',

  // === CreateTableModal ===
  createTableTitle: 'Создать стол',
  tableNameLabel: 'Название стола',
  gameTypeLabel: 'Тип игры',
  cashGame: 'Кэш-игра',
  miniTournament: 'Мини-турнир',
  smallBlindLabel: 'Малый блайнд',
  bigBlindLabel: 'Большой блайнд',
  timePerMoveLabel: 'Время на ход (сек)',
  timeBankLabel: 'Запас на раздумья (сек)',
  dealerLabel: 'Дилер',
  dealerRobot: '🤖 Робот',
  dealerFrol: '😏 Фрол',
  dealerDanilka: '🃏 Данилка',
  minBuyinLabel: 'Мин. байин',
  maxBuyinLabel: 'Макс. байин',
  startingStackLabel: 'Стартовый стек',
  blindIntervalLabel: 'Повышение блайндов (раздач)',
  blindMultiplierLabel: 'Множитель блайндов',
  enterTableName: 'Введите название стола',
  creating: 'Создание...',
  create: 'Создать',
  cancel: 'Отмена',

  // === JoinTableModal ===
  joinTableTitle: 'Присоединиться к столу',
  typeLabel: 'Тип',
  buyinLabel: 'Байин',
  joining: 'Вход...',
  joinTable: 'Войти за стол',

  // === FrolTipModal ===
  frolWorkedGreat: 'Фрол отлично поработал!',
  leaveTip: 'Оставить чаевые?',
  chips: 'фишек',
  giveTip: '💰 Дать чаевые',
  decline: 'Отказаться',
  declineTrick: 'Отказаться*',
  trickDisclaimer: '* Нажимая «Отказаться», вы подтверждаете согласие с максимальным чаевым',

  // === RebuyModal ===
  rebuyRequestTitle: 'Запрос на додеп',
  wantsRebuy: 'хочет додеп на сумму',
  allow: 'Разрешить?',
  no: 'Нет',
  yes: 'Да',
  playerFallback: 'Игрок',

  // === GameControls ===
  rebuyWaiting: 'Ожидание...',
  rebuyBtn: 'Додеп',
  returnToGame: '🔙 Вернуться в игру',
  fold: 'Фолд',
  check: 'Чек',
  call: 'Колл',
  raise: 'Рейз',
  allIn: 'Олл-ин',
  returnBack: '🔙 Вернуться',
  goAway: '💤 Отойти со следующей руки',
  cancelAway: '❌ Отменить отход',
  buyChips: '💰 Купить фишки',
  halfPot: '½ Банк',
  pot: 'Банк',

  // === DealerAvatar ===
  dealerNames: {
    robot: 'Робот',
    frol: 'Фрол',
    danilka: 'Данилка',
  } as Record<string, string>,

  // === DanilkaOverlay ===
  cardsDropped: 'Ой, карты выпали!',
  redeal: 'Перераздача!',

  // === PlayerContextMenu ===
  stackLabel: 'Стек',
  amountPlaceholder: 'Сумма',
  send: 'Отправить',
  tipBtn: '💰 Типнуть',
  accuseStalling: '⏱ Упрекнуть в столлинге',
  kickBtn: '❌ Кикнуть',
  kickConfirm: (name: string) => `Кикнуть ${name}? Будет выполнен принудительный кэшаут.`,

  // === TableView ===
  tableFallback: 'Стол',
  roundPrefix: 'Раздача #',
  startGame: '▶ Начать игру',
  cashoutBtn: '💰 Кэшаут',
  potDisplay: 'Банк',
  ledger: 'Леджер',
  deposit: 'Ввод',
  withdrawal: 'Вывод',
  frolTips: '🎩 Фрол (чаевые)',
  gameLogTitle: 'Лог игры',
  cashoutConfirm: 'Вы уверены, что хотите сделать кэшаут и покинуть стол?',
  stallingOverlay: 'СТОЛЛИШЬ!',

  // === Settings ===
  settingsTitle: '⚙ Настройки',
  settingAvatarSize: 'Размер аватарок',
  settingFontSize: 'Размер шрифта',
  settingCommunityCardSize: 'Карты на столе',
  settingPlayerCardSize: 'Карты игроков',
  settingControlsSize: 'Меню действий',
  settingDisplayBB: 'Отображать в ББ',
  settingHotkeys: 'Горячие клавиши',
  settingVibrate: 'Вибрация (моб.)',
  settingConfirmAllIn: 'Подтверждение олл-ина',
  settingOpponentVolume: 'Громкость соперников',
  settingReset: 'Сбросить',

  // === Hotkeys panel ===
  hotkeysTitle: '⌨ Хоткеи',
  hotkeysActionsHeader: 'Действия',
  hotkeysPresetsHeader: 'Пресеты рейза (ББ)',
  hotkeyFold: 'Фолд',
  hotkeyCheckCall: 'Чек / Колл',
  hotkeyRaiseMin: 'Мин. рейз',
  hotkeyRaiseConfirm: 'Подтвердить рейз',
  hotkeyAllIn: 'Олл-ин',
  hotkeyStepUp: 'Увеличить рейз',
  hotkeyStepDown: 'Уменьшить рейз',
  hotkeyAway: 'Отойти / вернуться',
  hotkeyPreset: (i: number) => `Пресет ${i}`,
  hotkeyPressKey: 'Нажмите клавишу…',
  hotkeyRebindHint: 'Клик — задать клавишу, Esc — отмена',
  hotkeyResetAll: 'Сбросить хоткеи',
  hotkeyResetPresets: 'Сбросить пресеты',

  // === Toasts / errors ===
  toastConnectionLost: 'Связь со столом потеряна. Переподключаемся…',
  toastConnectionRestored: 'Связь восстановлена',
  toastActionFailed: 'Действие не удалось',
  toastAvatarUpdated: 'Аватар обновлён',
};
