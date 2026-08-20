(() => {
  const config = window.RACE_CONFIG;
  const community = window.DERBY_COMMUNITY || { previewMode: true, serverName: 'Discord community', sampleEntries: [] };
  const backend = window.DERBY_SUPABASE || {};
  const hasBackendConfig = !community.previewMode
    && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(backend.url || ''))
    && /^sb_publishable_[A-Za-z0-9_-]+$/.test(String(backend.publishableKey || ''))
    && !!window.supabase?.createClient;
  const supabaseClient = hasBackendConfig
    ? window.supabase.createClient(backend.url, backend.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  const racers = config.racers;
  const officialRacers = [...racers].sort((a, b) => a.name.localeCompare(b.name));
  const trackRacers = [...officialRacers];
  const racerFrameUrls = Object.fromEntries(['rodster','tatiana','bike','tom','whitesw0n'].map((id) => [
    id,
    Array.from({length: 12}, (_, i) => `assets/realistic-v43/${id}/frame-${String(i).padStart(2, '0')}.png`)
  ]));
  const racerFrameTiming = { rodster: 100, tatiana: 100, bike: 96, tom: 98, whitesw0n: 100 };
  const racerFrameOffset = { rodster: 0, tatiana: 3, bike: 6, tom: 9, whitesw0n: 2 };
  const racerLastFrame = {};
  let racerAnimationStart = 0;

  function preloadRacerFrames() {
    return Promise.all(Object.values(racerFrameUrls).flat().map((src) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    })));
  }
  const tatianaFrameUrls = [0,2,3,4,5,6,7,8,11,8,7,6,5,4,3,2].map((i) => `assets/racers/tatiana-v29/frame-${String(i).padStart(2, '0')}.png`);
  const whitesw0nFrameUrls = Array.from({length: 8}, (_, i) => `assets/racers/whitesw0n-v32/frame-${String(i).padStart(2, '0')}.png`);
  const tomFrameUrls = Array.from({length: 8}, (_, i) => `assets/racers/tom-v32/frame-${String(i).padStart(2, '0')}.png`);
  [...tatianaFrameUrls, ...whitesw0nFrameUrls, ...tomFrameUrls].forEach((src) => { const img = new Image(); img.src = src; });
  let tatianaLastFrame = -1;
  let whitesw0nLastFrame = -1;
  let tomLastFrame = -1;
  const state = {
    currentPrice: config.startPrice,
    previousPrice: config.startPrice,
    priceChange24h: null,
    sparklinePrices: [],
    officialLow: config.startPrice,
    dailyCandles: [],
    hourlyLows: [],
    lastUpdated: null,
    lastDailyClose: null,
    prevDailyClose: null,
    completedDailyCloses: 0,
    localVotes: community.previewMode ? loadVoteCounts() : emptyVoteCounts(),
    voteLog: community.previewMode ? loadVoteLog() : [],
    userPick: community.previewMode ? loadUserPick() : null,
    probabilities: {},
    liveLeaders: ['tom', 'tatiana'],
    finalProjectedWinner: 'tom',
    volatility: 0.035,
    motionCycle: -1,
    verifiedUser: community.previewMode ? loadVerifiedDiscordUser() : null,
    publicEntries: community.previewMode ? loadPreviewPublicEntries() : [],
    communityLoading: !community.previewMode,
    communityError: '',
    voteSubmitting: false,
  };

  const $ = (id) => document.getElementById(id);

  function isOwnerView() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('ownerLog') === (config.betting.ownerLogKey || '');
    } catch (_) { return false; }
  }

  function configureOwnerVoteTools() {
    const tools = document.querySelector('.vote-tools');
    const panel = $('vote-log-panel');
    if (!tools || !panel) return;
    if (isOwnerView()) {
      tools.classList.add('owner-visible');
      panel.classList.add('owner-visible');
    } else {
      tools.classList.remove('owner-visible');
      panel.classList.remove('owner-visible');
      panel.textContent = '';
    }
  }

  function init() {
    $('title').textContent = config.title;
    $('subtitle').textContent = config.subtitle;
    $('bet-note').textContent = config.betting.note;
    configureOwnerVoteTools();
    renderCrowds();
    renderFenceSigns();
    attachVoteToolButtons();
    render();
    if (!community.previewMode) initializeCommunityBackend();
    tickClock();
    setInterval(tickClock, 1000);
    preloadRacerFrames().then(() => {
      racerAnimationStart = performance.now();
      document.body.classList.add('v40-animation-ready');
      requestAnimationFrame(animateRacersInPlace);
    });
    refreshAll();
    setInterval(refreshTicker, config.data.liveRefreshMs);
    setInterval(refreshHistory, config.data.historyRefreshMs);
  }

  function animateRacersInPlace(now) {
    const elapsed = Math.max(0, now - racerAnimationStart);
    Object.keys(racerFrameUrls).forEach((id) => {
      const step = Math.floor(elapsed / racerFrameTiming[id]) + racerFrameOffset[id];
      const frame = ((step % 12) + 12) % 12;
      if (racerLastFrame[id] === frame) return;
      racerLastFrame[id] = frame;
      const nextSrc = racerFrameUrls[id][frame];
      document.querySelectorAll(`.v40-racer-frame[data-racer="${id}"]`).forEach((img) => {
        const current = img.getAttribute('src') || '';
        if (current !== nextSrc) img.setAttribute('src', nextSrc);
      });
    });
    requestAnimationFrame(animateRacersInPlace);
  }

  async function refreshAll() {
    await Promise.all([refreshTicker(), refreshHistory()]);
    render();
  }

  async function fetchJson(url) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {})
      });
      if (!response.ok) throw new Error(`market data request failed (${response.status})`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('market data response was empty');
      return data;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function refreshTicker() {
    let price = null;
    let change24h = null;
    const statsUrl = config.data.statsUrl
      || String(config.data.tickerUrl).replace(/\/ticker(?:\?.*)?$/, '/stats');

    try {
      const [tickerResult, statsResult] = await Promise.allSettled([
        fetchJson(config.data.tickerUrl),
        fetchJson(statsUrl)
      ]);
      if (tickerResult.status === 'fulfilled') {
        const tickerPrice = Number(tickerResult.value?.price);
        if (tickerPrice > 0) price = tickerPrice;
      }
      if (statsResult.status === 'fulfilled') {
        const last = Number(statsResult.value?.last);
        const open = Number(statsResult.value?.open);
        if (!(price > 0) && last > 0) price = last;
        if (last > 0 && open > 0) change24h = ((last - open) / open) * 100;
      }
    } catch (_) {}

    if (!(price > 0) || !Number.isFinite(change24h)) {
      try {
        const fallbackUrl = new URL(config.data.fallbackTickerUrl);
        fallbackUrl.searchParams.set('include_24hr_change', 'true');
        const fallback = await fetchJson(fallbackUrl.toString());
        const fallbackPrice = Number(fallback?.bitcoin?.usd);
        const fallbackChange = Number(fallback?.bitcoin?.usd_24h_change);
        if (!(price > 0) && fallbackPrice > 0) price = fallbackPrice;
        if (Number.isFinite(fallbackChange)) change24h = fallbackChange;
      } catch (_) {}
    }

    if (price > 0) {
      state.previousPrice = state.currentPrice;
      state.currentPrice = price;
      if (Number.isFinite(change24h)) state.priceChange24h = change24h;
      state.officialLow = Math.min(Number(state.officialLow) || price, price);
      state.lastUpdated = new Date();
      render();
    } else {
      console.warn('live BTC ticker refresh failed; keeping the last good value');
    }
  }

  async function refreshHistory() {
    const now = new Date();
    let fallbackHistoryPromise = null;
    const fallbackHistory = () => {
      if (!fallbackHistoryPromise) {
        fallbackHistoryPromise = fetchFallbackCandles(new Date(config.startDate), now);
      }
      return fallbackHistoryPromise;
    };
    const [dailyResult, hourlyResult] = await Promise.allSettled([
      fetchCandles(new Date(config.startDate), now, 86400).catch(async (error) => {
        console.warn('Coinbase daily candles unavailable; using the secondary history feed', error);
        return rollupDailyCandles(await fallbackHistory());
      }),
      fetchCandles(new Date(config.startDate), now, 3600).catch(async (error) => {
        console.warn('Coinbase hourly candles unavailable; using the secondary history feed', error);
        return fallbackHistory();
      })
    ]);

    if (dailyResult.status === 'fulfilled') {
      state.dailyCandles = dailyResult.value.sort((a, b) => a[0] - b[0]);
      const completed = state.dailyCandles.filter((c) => c[0] + 86400 <= Math.floor(now.getTime() / 1000));
      state.completedDailyCloses = completed.length;
      if (completed.length) {
        state.lastDailyClose = Number(completed[completed.length - 1][4]);
        state.prevDailyClose = completed.length > 1 ? Number(completed[completed.length - 2][4]) : null;
      }
      state.volatility = computeVolatility(state.dailyCandles);
    } else {
      console.warn('daily BTC candle refresh failed', dailyResult.reason);
    }

    if (hourlyResult.status === 'fulfilled') {
      state.hourlyLows = hourlyResult.value.sort((a, b) => a[0] - b[0]);
      const lows = state.hourlyLows.map((c) => Number(c[1])).filter((value) => Number.isFinite(value));
      state.officialLow = lows.length
        ? Math.min(...lows, state.currentPrice)
        : Math.min(state.currentPrice, Number(state.officialLow) || config.startPrice);

      const dayAgo = Math.floor(now.getTime() / 1000) - 86400;
      const recentCandles = state.hourlyLows.filter((c) => Number(c[0]) >= dayAgo - 3600);
      const prices = recentCandles.map((c) => Number(c[4])).filter((value) => Number.isFinite(value) && value > 0);
      if (state.currentPrice > 0) prices.push(state.currentPrice);
      state.sparklinePrices = prices.slice(-25);

      if (!Number.isFinite(state.priceChange24h) && recentCandles.length) {
        const first = recentCandles[0];
        const open24h = Number(first[3]) || Number(first[4]);
        if (open24h > 0 && state.currentPrice > 0) {
          state.priceChange24h = ((state.currentPrice - open24h) / open24h) * 100;
        }
      }
    } else {
      console.warn('hourly BTC candle refresh failed', hourlyResult.reason);
    }

    render();
  }

  async function fetchFallbackCandles(startDate, endDate) {
    const url = new URL('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range');
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('from', String(Math.floor(startDate.getTime() / 1000)));
    url.searchParams.set('to', String(Math.floor(endDate.getTime() / 1000)));
    const data = await fetchJson(url.toString());
    const prices = Array.isArray(data?.prices) ? data.prices : [];
    if (!prices.length) throw new Error('secondary history response contained no prices');
    return prices
      .map((row) => {
        const time = Math.floor(Number(row?.[0]) / 1000);
        const price = Number(row?.[1]);
        return [time, price, price, price, price, 0];
      })
      .filter((row) => Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[1] > 0)
      .sort((a, b) => a[0] - b[0]);
  }

  function rollupDailyCandles(hourlyCandles) {
    const days = new Map();
    hourlyCandles.forEach((candle) => {
      const time = Number(candle[0]);
      const low = Number(candle[1]);
      const high = Number(candle[2]);
      const open = Number(candle[3]);
      const close = Number(candle[4]);
      if (![time, low, high, open, close].every(Number.isFinite)) return;
      const day = Math.floor(time / 86400) * 86400;
      const existing = days.get(day);
      if (!existing) days.set(day, [day, low, high, open, close, 0]);
      else {
        existing[1] = Math.min(existing[1], low);
        existing[2] = Math.max(existing[2], high);
        existing[4] = close;
      }
    });
    return [...days.values()].sort((a, b) => a[0] - b[0]);
  }

  async function fetchCandles(startDate, endDate, granularity) {
    const out = [];
    const maxPoints = 280;
    const chunkSeconds = granularity * maxPoints;
    let cursor = Math.floor(startDate.getTime() / 1000);
    const end = Math.floor(endDate.getTime() / 1000);
    while (cursor < end) {
      const chunkEnd = Math.min(cursor + chunkSeconds, end);
      const url = new URL(config.data.candlesUrl);
      url.searchParams.set('granularity', String(granularity));
      url.searchParams.set('start', new Date(cursor * 1000).toISOString());
      url.searchParams.set('end', new Date(chunkEnd * 1000).toISOString());
      const data = await fetchJson(url.toString());
      if (!Array.isArray(data)) throw new Error('candle response was not an array');
      data.forEach((row) => out.push(row));
      cursor = chunkEnd;
    }
    const seen = new Set();
    return out.filter((row) => {
      if (!Array.isArray(row) || seen.has(row[0])) return false;
      seen.add(row[0]);
      return true;
    });
  }

  function computeVolatility(candles) {
    const closes = candles.map((c) => Number(c[4])).filter(Boolean);
    if (closes.length < 4) return 0.035;
    const returns = [];
    for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
    const sample = returns.slice(-20);
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const variance = sample.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, sample.length - 1);
    return Math.max(0.02, Math.min(0.08, Math.sqrt(variance)));
  }

  function render() {
    state.liveLeaders = getLiveLeaders();
    state.probabilities = calculateBookieProbabilities();
    state.finalProjectedWinner = Object.entries(state.probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] || 'tom';
    renderAltHeader();
    renderTopStats();
    renderStatusRibbon();
    renderInsightRow();
    renderTrack();
    renderFenceSigns();
    renderDepthCard();
    renderRulesCard();
    renderCommunityEntry();
    renderBookieBoard();
    renderPaddockPicks();
    renderVoteLog();
    renderFooterMetrics();
  }

  function renderAltHeader() {
    const priceEl = $('alt-btc-price');
    const deltaEl = $('alt-btc-delta');
    const end = new Date(config.endDate).getTime();
    const total = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if ($('alt-days')) $('alt-days').textContent = String(days).padStart(2, '0');
    if ($('alt-hours')) $('alt-hours').textContent = String(hours).padStart(2, '0');
    if ($('alt-mins')) $('alt-mins').textContent = String(mins).padStart(2, '0');
    if ($('alt-secs')) $('alt-secs').textContent = String(secs).padStart(2, '0');
    if (priceEl) priceEl.textContent = formatCurrency(state.currentPrice);
    if (deltaEl) {
      const has24h = Number.isFinite(state.priceChange24h);
      const pct = has24h ? state.priceChange24h : 0;
      deltaEl.textContent = has24h ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% 24H` : '-- 24H';
      deltaEl.style.color = !has24h ? '#b9cbe0' : (pct >= 0 ? '#45db9a' : '#ff5366');
      deltaEl.title = 'Bitcoin price change over the trailing 24 hours';
    }
    renderSparkline();
  }

  function renderSparkline() {
    const svg = document.querySelector('.alt-spark');
    const polyline = svg?.querySelector('polyline');
    if (!svg || !polyline) return;
    const values = state.sparklinePrices
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .slice(-25);
    if (state.currentPrice > 0 && values[values.length - 1] !== state.currentPrice) values.push(state.currentPrice);
    if (values.length < 2) return;

    const width = 128;
    const height = 38;
    const padding = 3;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const range = Math.max(1, high - low);
    const points = values.map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = padding + ((high - value) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    polyline.setAttribute('points', points);

    const has24h = Number.isFinite(state.priceChange24h);
    const pct = has24h ? state.priceChange24h : 0;
    svg.style.color = !has24h ? '#b9cbe0' : (pct >= 0 ? '#45db9a' : '#ff5366');
    svg.setAttribute(
      'aria-label',
      has24h
        ? `Bitcoin 24-hour price chart, ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(2)} percent`
        : 'Bitcoin 24-hour price chart'
    );
  }

  function renderTopStats() {
    const delta = state.currentPrice - state.previousPrice;
    const leaders = state.liveLeaders.map((id) => findRacer(id).name).join(' & ');
    $('top-stats').innerHTML = [
      statCard('BTC/USD', formatCurrency(state.currentPrice), `${delta >= 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(delta))} since last update`, delta >= 0 ? 'up' : 'down'),
      statCard('Official race low', formatCurrency(state.officialLow), `Lowest trade since ${formatDateShort(config.startDate)}`, ''),
      statCard('Countdown', formatCountdownToEnd(), 'until the October 6 finish', ''),
      statCard('Live target in front', leaders, state.liveLeaders.length > 1 ? 'Both bottom-is-in calls remain alive' : findRacer(state.liveLeaders[0]).displayPick, 'accent')
    ].join('');
  }

  function statCard(label, value, small, tone = '') {
    return `<article class="card stat-card ${tone}"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><span class="stat-small">${small}</span></article>`;
  }

  function renderStatusRibbon() {
    const names = state.liveLeaders.map((id) => findRacer(id).name);
    const title = names.length > 1 ? `${names.join(' and ')} are tied at the front` : `${names[0]} currently leads the field`;
    const detail = names.length > 1
      ? 'Both “bottom is in” calls are still valid. Tom allows a dip toward $59k, while Tatiana allows a deeper flush toward $53.3k.'
      : `${findRacer(state.liveLeaders[0]).displayPick}. ${findRacer(state.liveLeaders[0]).note || findRacer(state.liveLeaders[0]).liveRuleText}`;
    $('status-ribbon').innerHTML = `
      <div class="status-left"><img src="${findRacer(state.liveLeaders[0]).avatar}" alt="" class="tiny-avatar"><div><strong>${title}</strong><div>${detail}</div></div></div>
      <div class="status-right">${state.lastUpdated ? `Coinbase live · ${formatLocalTime(state.lastUpdated)}` : 'Waiting for live BTC data…'}</div>`;
  }

  function renderInsightRow() {
    const nextClose = countdownToNextDailyClose();
    const favoriteId = Object.entries(state.probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] || 'tom';
    const weather = state.volatility > 0.045 ? 'Windy volatility' : state.volatility > 0.032 ? 'Cloudy volatility' : 'Calm consolidation';
    const recap = generateRecap();
    const crowdLeader = Object.entries(state.localVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'tatiana';
    $('insight-row').innerHTML = `
      <article class="card insight-card"><div class="icon">🔔</div><div><span class="mini-title">Daily candle close</span><strong>Close Bell</strong><div>Next horse move in <span class="accent-text">${nextClose}</span></div></div></article>
      <article class="card insight-card"><div class="icon">⛅</div><div><span class="mini-title">Track conditions</span><strong>${weather}</strong><div>Positions only update after a completed daily candle.</div></div></article>
      <article class="card insight-card"><div class="icon">📈</div><div><span class="mini-title">Model favorite</span><strong>${findRacer(favoriteId).name}</strong><div><span class="accent-text">${state.probabilities[favoriteId].toFixed(1)}%</span> model chance · crowd favorite is ${findRacer(crowdLeader).name}</div></div></article>
      <article class="card insight-card recap"><div class="icon">🎙️</div><div><span class="mini-title">Race recap</span><strong>${recap.title}</strong><div>${recap.body}</div></div></article>`;
  }

  function generateRecap() {
    const leaders = state.liveLeaders.map((id) => findRacer(id).name);
    const projected = findRacer(state.finalProjectedWinner).name;
    if (leaders.length > 1) {
      return {
        title: `${leaders.join(' and ')} share the lead`,
        body: `${leaders.join(' and ')} are both right on the broad “bottom is in” thesis. The bookie model currently leans ${projected}, but the official October 6 winner is whichever call finishes closest to Bitcoin's contest low.`
      };
    }
    return {
      title: `${leaders[0]} has the live edge`,
      body: `${leaders[0]} owns the running lead today. ${projected} is the model favorite right now, but deeper targets can still surge if Bitcoin flushes lower before October 6.`
    };
  }


  function renderTrack() {
    $('daily-close-note').textContent = `• Positions change only after a completed daily candle at ${String(config.dailyCloseHourUtc).padStart(2, '0')}:00 UTC`;
    $('start-price-note').textContent = `Starting gate ${formatCurrency(config.startPrice)}`;
    const totalDays = totalDailyCloses();
    const baseProgress = Math.min(1, state.completedDailyCloses / Math.max(1, totalDays));
    const rankMap = liveRankMap();
    const laneText = {
      whitesw0n: '$37,999',
      tatiana: 'Bottom in · max $53.3k',
      tom: 'Bottom in · max $59k',
      rodster: '$47,976',
      bike: '$38,750'
    };
    const statusWords = {
      whitesw0n: ['LLAMA ENERGY', 'SOFT CHAOS', 'WOOLY WISDOM', 'ALPACA ALPHA', 'NECK AND NECK', 'SPITTING FIRE', 'FLOATING LOW', 'QUIETLY CLOSING', 'FLOOF IN FLIGHT', 'PASTURE PRESSURE', 'CLOUD SOFT STRIDE', 'FUZZY FURY'],
      tom: ['CARROT QUEST', 'HEE-HAW MODE', 'DUST KICKIN', 'SNACK ATTACK', 'EARS BACK', 'BURRO BLITZ', 'HAYWIRE RUN', 'MULE MOMENTUM', 'CARROT CRUISE', 'DONKEY DASH', 'BARNSTORMING', 'HOOFING IT'],
      tatiana: ['MIDNIGHT GLIDE', 'BLACK HORSE MAGIC', 'SHADE SHIFT', 'DEEPER DIVE', 'SUNGLESSED SURGE', 'VELVET THUNDER', 'DARK HORSE DRIVE', 'MOONSHOT STRIDE', 'NOIR GALLOP', 'AFTERHOURS CHARGE', 'ECLIPSE RUN', 'NIGHT RIDER'],
      rodster: ['CHARGING', 'BANNER HIGH', 'LANCE READY', 'ARMORED PUSH', 'FULL TILT', 'IRON GALLOP', 'KNIGHT MOVE', 'SPEARHEADING', 'JOUST JUICE', 'SHIELD UP', 'WARHORSE ROLL', 'BATTLE CANTER'],
      bike: ['PEDALING', 'SPIN TO WIN', 'FULL GAS', 'CHAIN RING HOT', 'CADENCE UP', 'PEAK TORQUE', 'WHEEL TO WHEEL', 'SADDLE DOWN', 'HAMMER DOWN', 'BREAKAWAY MODE', 'AERO TUCK', 'OUT OF THE SADDLE', 'CRANKING HARD', 'PELOTON POP', 'BURNING RUBBER', 'SPRINTING AWAY']
    };
    const motionWordFor = (r, laneIndex) => {
      const words = statusWords[r.id] || [];
      if (!words.length) return '';
      const rank = rankMap[r.id] || 5;
      const timeBucket = Math.floor(Date.now() / 12000);
      const seed = (state.completedDailyCloses * 5) + (laneIndex * 3) + timeBucket + rank;
      return words[seed % words.length];
    };
    const badgeFor = (r) => {
      const rank = rankMap[r.id] || 5;
      return rank === 1 && state.liveLeaders.length > 1 ? 'T1' : String(rank);
    };
    const xFor = (r) => {
      const rank = rankMap[r.id] || 5;
      const rankAdvance = { 1: 0.17, 2: 0.13, 3: 0.10, 4: 0.07, 5: 0.045 }[rank] || 0.045;
      return Math.min(0.88, 0.16 + baseProgress * 0.42 + rankAdvance);
    };

    $('track-leaderboard').innerHTML = '';
    $('track-lanes').innerHTML = trackRacers.map((r, i) => {
      const x = xFor(r);
      const motionLine = motionWordFor(r, i);
      return `
        <div class="lane broadcast-lane lane-${i + 1}" style="--racer-accent:${r.color}">
          <div class="lane-card">
            <div class="lane-rank">${badgeFor(r)}</div>
            <img src="${r.discordAvatar || r.avatar}" alt="${r.name} Discord avatar" class="lane-avatar">
            <div class="lane-copy">
              <strong>${r.name}</strong>
              <span>${laneText[r.id] || r.displayPick}</span>
              <em>${motionLine}</em>
            </div>
          </div>
          <div class="lane-track">
            <div class="lane-line"></div>
            <div class="horse-wrap racer-${r.id}" style="left:${(x * 100).toFixed(1)}%">
              ${racerArtMarkup(r)}
            </div>
          </div>
        </div>`;
    }).join('');
  }



  function racerArtMarkup(r) {
    const currentFrame = racerLastFrame[r.id] ?? 0;
    const firstFrame = racerFrameUrls[r.id]?.[currentFrame] || '';
    return `
      <div class="racer-motion racer-${r.id} v40-real-motion" aria-label="${r.name} realistic twelve-frame animated racer">
        <div class="v40-real-racer-shell">
          <img class="v40-racer-frame v40-${r.id}" data-racer="${r.id}" src="${firstFrame}" alt="${r.name} racer" draggable="false">
        </div>
        <span class="road-shadow"></span>
      </div>`;
  }

  function renderDepthCard() {
    const entries = [
      { id: 'officialLow', value: state.officialLow, label: `Race low ${formatCompact(state.officialLow)}`, type: 'low', note: 'Locked contest low' },
      { id: 'tom', value: 59000, label: 'Tom', type: 'tom', note: '$59k' },
      { id: 'tatiana', value: 53300, label: 'Tatiana', type: 'tatiana', note: '$53.3k' },
      { id: 'rodster', value: 47976, label: 'Rodster', type: 'rodster', note: '$47,976' },
      { id: 'bike', value: 38750, label: 'Bike', type: 'bike', note: '$38,750' },
      { id: 'whitesw0n', value: 37999, label: 'WhiteSw0n', type: 'whitesw0n', note: '$37,999' }
    ];
    const min = 37000;
    const highestPrice = Math.max(config.startPrice, state.currentPrice, state.officialLow, 70000);
    const max = Math.max(75000, Math.ceil(highestPrice / 5000) * 5000);
    const range = Math.max(1, max - min);
    const pctFor = (value) => Math.max(5, Math.min(95, ((max - value) / range) * 100));
    const ticks = [...new Set([max, 70000, 64000, 59000, 53300, 48000, 39000, 38000])]
      .filter((value) => value <= max && value >= min);
    const pointerPct = pctFor(state.currentPrice);
    const pointerTone = pointerPct < 20 ? 'tone-high' : pointerPct < 40 ? 'tone-mid' : pointerPct < 65 ? 'tone-lower' : 'tone-deep';
    $('depth-card').innerHTML = `
      <h2>Bitcoin Depth Meter</h2>
      <p class="muted">The live pointer tracks BTC now. The contest low remains locked separately for the final result.</p>
      <div class="meter-layout">
        <div class="meter-wrap"><div class="meter-scale compact-meter">
          <div class="meter-bar"></div>
          <div class="meter-pointer ${pointerTone}" style="top:${pointerPct.toFixed(1)}%"><b class="pointer-arrow">←</b><span class="pointer-price">${formatCurrency(state.currentPrice)}</span></div>
          ${ticks.map((value) => `<div class="tick" style="top:${pctFor(value).toFixed(1)}%"><span>${formatCompact(value)}</span></div>`).join('')}
        </div></div>
        <div class="meter-legend">
          ${entries.map((e) => `<div class="meter-entry ${e.type}"><span class="meter-dot"></span><div><strong>${e.label}</strong><small>${e.note}</small></div></div>`).join('')}
        </div>
      </div>
      <div class="depth-trend">Official contest low <strong>${formatCurrency(state.officialLow)}</strong></div>`;
  }

  function renderRulesCard() {
    $('rules-card').innerHTML = `
      <h2>🏁 Race Info</h2>
      <div class="race-info-grid">
        <div class="race-info-row"><span>⏱ Race Start</span><strong>${formatDateShort(config.startDate)}</strong></div>
        <div class="race-info-row"><span>🏁 Finish Line</span><strong>Oct 6, 2026</strong></div>
        <div class="race-info-row"><span>🎯 Target</span><strong>Lowest BTC trade</strong></div>
        <div class="race-info-row"><span>👥 Entry</span><strong>Verified Discord only</strong></div>
        <div class="race-info-row"><span>🏆 Prize</span><strong>$100 in TAO</strong></div>
      </div>
      <button class="race-how-btn" type="button" title="Official winner is the call closest in dollars to Bitcoin's lowest trade during the contest.">ⓘ How It Works</button>`;
  }

  async function initializeCommunityBackend() {
    if (!supabaseClient) {
      state.communityLoading = false;
      state.communityError = 'Discord entry is temporarily unavailable while the live connection loads.';
      render();
      return;
    }
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      await applyCommunitySession(data.session || null);
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        window.setTimeout(() => applyCommunitySession(session || null), 0);
      });
    } catch (error) {
      console.error('Community connection failed:', error);
      state.communityLoading = false;
      state.communityError = 'The community board could not connect. Refresh the page and try again.';
      render();
    }
  }

  async function applyCommunitySession(session) {
    state.communityLoading = true;
    state.communityError = '';
    state.verifiedUser = session?.user ? discordUserFromSession(session.user) : null;
    state.userPick = null;
    render();
    try {
      await refreshCommunityData();
      if (session?.user) await loadMyLockedPick();
    } catch (error) {
      console.error('Community data refresh failed:', error);
      state.communityError = 'Live community totals are temporarily unavailable.';
    } finally {
      state.communityLoading = false;
      render();
    }
  }

  function discordUserFromSession(user) {
    const meta = user?.user_metadata || {};
    const identity = Array.isArray(user?.identities)
      ? user.identities.find((item) => item.provider === 'discord')
      : null;
    const identityData = identity?.identity_data || {};
    const name = String(
      meta.full_name || meta.name || meta.user_name ||
      identityData.full_name || identityData.name || identityData.user_name ||
      'Discord member'
    ).trim();
    const avatar = firstHttpsUrl([
      meta.avatar_url,
      identityData.avatar_url,
    ]);
    return { id: user.id, name: name.slice(0, 100), avatar, verified: true };
  }

  function firstHttpsUrl(values) {
    const found = values.map((value) => String(value || '')).find((value) => value.startsWith('https://'));
    return found || '';
  }

  async function refreshCommunityData() {
    const contestId = backend.contestId || 'bitcoin-bottom-derby-2026';
    const [totalsResult, entriesResult] = await Promise.all([
      supabaseClient.rpc('get_derby_vote_totals', { p_contest_id: contestId }),
      supabaseClient.rpc('get_derby_public_entries', { p_contest_id: contestId })
    ]);
    if (totalsResult.error) throw totalsResult.error;
    if (entriesResult.error) throw entriesResult.error;

    const totals = emptyVoteCounts();
    (totalsResult.data || []).forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(totals, row.racer_id)) {
        totals[row.racer_id] = Math.max(0, Number(row.vote_count) || 0);
      }
    });
    state.localVotes = totals;
    state.publicEntries = (entriesResult.data || []).map((row, index) => ({
      id: `${row.created_at || index}-${row.racer_id}-${index}`,
      name: String(row.discord_display_name || 'Discord member'),
      avatar: firstHttpsUrl([row.discord_avatar_url]),
      racerId: row.racer_id,
      oddsAtEntry: row.odds_at_entry || '',
      createdAt: row.created_at || ''
    }));
  }

  async function loadMyLockedPick() {
    const { data, error } = await supabaseClient.rpc('get_my_derby_vote', {
      p_contest_id: backend.contestId || 'bitcoin-bottom-derby-2026'
    });
    if (error) throw error;
    const vote = Array.isArray(data) ? data[0] : data;
    if (!vote) return;
    state.userPick = vote.racer_id;
    if (state.verifiedUser) {
      state.verifiedUser.name = String(vote.discord_display_name || state.verifiedUser.name);
      state.verifiedUser.avatar = firstHttpsUrl([vote.discord_avatar_url, state.verifiedUser.avatar]);
    }
  }

  async function startDiscordLogin() {
    if (!supabaseClient) {
      alert('Discord entry is temporarily unavailable. Please refresh the page and try again.');
      return;
    }
    state.communityError = '';
    state.communityLoading = true;
    render();
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: backend.redirectTo || window.location.href.split('#')[0].split('?')[0] }
    });
    if (error) {
      state.communityLoading = false;
      state.communityError = error.message || 'Discord sign-in could not start.';
      render();
    }
  }

  async function signOutCommunityMember() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    state.verifiedUser = null;
    state.userPick = null;
    state.communityError = '';
    await refreshCommunityData().catch(() => {});
    render();
  }

  function renderCommunityEntry() {
    const panel = $('discord-entry-panel');
    if (!panel) return;
    const user = state.verifiedUser;
    const picked = state.userPick ? findRacer(state.userPick) : null;
    const previewBadge = community.previewMode ? '<span class="preview-mode-badge">PREVIEW</span>' : '';
    const connectionNote = state.communityError
      ? `<div class="entry-privacy community-error">${escapeHtml(state.communityError)}</div>`
      : `<div class="entry-privacy">${escapeHtml(community.publicPickDisclosure || 'Your Discord display name, avatar and Derby pick will be public.')}</div>`;

    if (!user) {
      panel.innerHTML = `
        <div class="discord-entry-copy">
          <div class="entry-kicker">${previewBadge}<span class="verified-pill">✓ VERIFIED ENTRY</span></div>
          <h3>🎟 Enter the Derby</h3>
          <p>Sign in with Discord to cast one locked pick. Anyone can watch the race.</p>
          ${connectionNote}
        </div>
        <div class="discord-entry-actions">
          <button id="discord-login-btn" class="discord-login-btn" ${state.communityLoading ? 'disabled' : ''}>${state.communityLoading ? 'Connecting…' : 'Discord&nbsp;&nbsp; Sign in to enter'}</button>
          <small>The Derby never asks for your Discord password.</small>
        </div>`;
      $('discord-login-btn')?.addEventListener('click', community.previewMode ? previewDiscordLogin : startDiscordLogin);
      return;
    }

    const initials = initialsFor(user.name);
    const memberAvatar = user.avatar
      ? `<img class="member-avatar" src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">`
      : `<div class="member-avatar initials-avatar">${escapeHtml(initials)}</div>`;
    const options = officialRacers.map((r) => {
      const chosen = picked && picked.id === r.id;
      return `<button class="bet-btn alt-pick-option ${chosen ? 'chosen' : ''}" data-racer="${r.id}" ${picked || state.voteSubmitting ? 'disabled' : ''}>
        <img src="${r.avatar}" alt="${r.name}"><strong>${r.name}</strong><span>${r.displayPick}</span>
      </button>`;
    }).join('');
    panel.innerHTML = `
      <div class="verified-member-row">
        ${memberAvatar}
        <div class="verified-member-copy">
          <div class="entry-kicker">${previewBadge}<span class="verified-pill">✓ VERIFIED</span></div>
          <h3>${escapeHtml(user.name)}</h3>
          <p>${picked ? `Your Derby pick is locked: <strong>${picked.name}</strong> — ${picked.displayPick}.` : 'Choose your racer below. Your pick locks after confirmation.'}</p>
          ${community.previewMode ? '' : '<button id="discord-signout-btn" class="member-signout-btn" type="button">Sign out</button>'}
        </div>
        <div class="entry-status-box ${picked ? 'locked' : ''}">
          <span>${picked ? 'YOUR PICK' : 'STATUS'}</span>
          <strong>${picked ? picked.name : state.voteSubmitting ? 'Saving…' : 'Ready'}</strong>
          ${picked ? '' : `<small>${state.voteSubmitting ? 'Please wait' : 'One pick only'}</small>`}
        </div>
        <div class="alt-racer-options">${options}</div>
      </div>`;
    $('discord-signout-btn')?.addEventListener('click', signOutCommunityMember);
  }

  function previewDiscordLogin() {
    if (!community.previewMode) {
      alert('Discord login will open here after the live Discord + Supabase connection is configured.');
      return;
    }
    const entered = window.prompt('Preview the verified-member experience. Enter a Discord display name:', 'DerbyFan');
    const name = (entered || '').trim();
    if (!name) return;
    state.verifiedUser = { id: 'preview-local-member', name, verified: true };
    saveVerifiedDiscordUser(state.verifiedUser);
    render();
  }

  function renderBookieBoard() {
    const totalVotes = totalVoteCount();
    const userPick = state.userPick;
    const verified = !!state.verifiedUser;
    $('odds-grid').innerHTML = officialRacers.map((r) => {
      const votes = state.localVotes[r.id] || 0;
      const share = totalVotes ? votes / totalVotes : 0;
      const prob = state.probabilities[r.id] || 0;
      const fracOdds = simplifyOdds((100 / Math.max(prob, 1)) - 1);
      const chosen = userPick === r.id;
      const disabled = !!userPick || !verified || state.voteSubmitting;
      const buttonText = chosen ? '✓ Your locked pick' : !verified ? 'Sign in to make a pick' : state.voteSubmitting ? 'Saving locked pick…' : `Pick ${r.name}`;
      return `
        <article class="odds-card ${chosen ? 'chosen' : ''}">
          <div class="odds-top"><img src="${r.avatar}" alt="${r.name}" class="odds-avatar"><div><h3>${r.name}</h3><p>${r.displayPick}${r.note ? `<br><small>${r.note}</small>` : ''}</p></div></div>
          <div class="odds-stats">
            <div><span>Model chance</span><strong>${prob.toFixed(1)}%</strong></div>
            <div><span>Bookie odds</span><strong>${fracOdds}</strong><small>${prob.toFixed(0)}% implied</small></div>
            <div><span>Tickets</span><strong>${votes}</strong></div>
            <div><span>Crowd share</span><strong>${(share * 100).toFixed(0)}%</strong></div>
          </div>
          <div class="vote-form compact-vote-form">
            <button class="bet-btn" data-racer="${r.id}" ${disabled ? 'disabled' : ''}>${buttonText}</button>
          </div>
        </article>`;
    }).join('');
    document.querySelectorAll('.bet-btn').forEach((btn) => btn.addEventListener('click', onBetClick));
  }

  async function onBetClick(event) {
    const racerId = event.currentTarget.getAttribute('data-racer');
    if (state.userPick || state.voteSubmitting) return;
    if (!state.verifiedUser) return alert('Sign in with Discord before making a pick.');
    const racer = findRacer(racerId);
    if (!window.confirm(`Lock ${racer.name} — ${racer.displayPick} as your Derby pick?\n\nYou cannot change it after submitting.`)) return;
    const discordName = state.verifiedUser.name;
    const oddsAtEntry = simplifyOdds((100 / Math.max(state.probabilities[racerId] || 1, 1)) - 1);
    if (community.previewMode) {
      state.userPick = racerId;
      state.localVotes[racerId] = (state.localVotes[racerId] || 0) + 1;
      saveUserPick(racerId, discordName);
      saveVoteCounts(state.localVotes);
      addPublicEntry({ id: state.verifiedUser.id, name: discordName, racerId });
      appendVoteLog({ ts: new Date().toISOString(), discordName, discordId: state.verifiedUser.id, racerId, racerName: racer.name, oddsAtEntry, confirmedMember: true });
      render();
      return;
    }

    if (!supabaseClient) return alert('The live voting connection is unavailable. Refresh the page and try again.');
    state.voteSubmitting = true;
    state.communityError = '';
    render();
    try {
      const { data, error } = await supabaseClient.functions.invoke(backend.functionName || 'quick-handler', {
        body: {
          contestId: backend.contestId || 'bitcoin-bottom-derby-2026',
          racerId,
          oddsAtEntry
        }
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
      const vote = data?.vote || {};
      state.userPick = vote.racer_id || racerId;
      if (state.verifiedUser) {
        state.verifiedUser.name = String(vote.discord_display_name || state.verifiedUser.name);
        state.verifiedUser.avatar = firstHttpsUrl([vote.discord_avatar_url, state.verifiedUser.avatar]);
      }
      await refreshCommunityData();
    } catch (error) {
      console.error('Vote submission failed:', error);
      const message = error?.message || 'Your pick could not be saved. Please try again.';
      state.communityError = message;
      alert(message);
      await loadMyLockedPick().catch(() => {});
      await refreshCommunityData().catch(() => {});
    } finally {
      state.voteSubmitting = false;
      render();
    }
  }

  async function edgeFunctionErrorMessage(error) {
    try {
      const response = error?.context;
      if (response?.clone) {
        const body = await response.clone().json();
        if (body?.error) return String(body.error);
      }
    } catch (_) {}
    return error?.message || 'Your pick could not be saved. Please try again.';
  }

  function renderPaddockPicks() {
    const panel = $('paddock-board');
    if (!panel) return;
    const entries = state.publicEntries || [];
    const groups = officialRacers.map((r) => ({ racer: r, entries: entries.filter((e) => e.racerId === r.id) }));
    const total = entries.length;
    const previewNote = community.previewMode
      ? '<span class="paddock-preview-note">Preview names below are sample data so you can see the end-user layout.</span>'
      : '';
    panel.innerHTML = `
      <div class="paddock-head">
        <div>
          <div class="paddock-kicker">🏇 PUBLIC COMMUNITY BOARD</div>
          <h2>Paddock Picks</h2>
          <p>See who backed each racer. Verified members appear here after their pick is locked.</p>
        </div>
        <div class="verified-count"><strong>${total}</strong><span>verified picks shown</span></div>
      </div>
      ${previewNote}
      <div class="paddock-grid">
        ${groups.map(({ racer, entries: fans }) => `
          <article class="paddock-team">
            <div class="paddock-team-head">
              <img src="${racer.avatar}" alt="" class="paddock-racer-avatar">
              <div><strong>${racer.name}</strong><span>${racer.displayPick}</span></div>
              <b>${fans.length}</b>
            </div>
            <div class="supporter-list">
              ${fans.length ? fans.map((fan) => {
                const avatar = fan.avatar
                  ? `<img class="supporter-avatar" src="${escapeHtml(fan.avatar)}" alt="">`
                  : `<span class="supporter-avatar">${escapeHtml(initialsFor(fan.name))}</span>`;
                return `<div class="supporter">${avatar}<span>${escapeHtml(fan.name)}</span><em>✓</em></div>`;
              }).join('') : '<div class="empty-supporters">Waiting for the first supporter…</div>'}
            </div>
          </article>`).join('')}
      </div>`;
  }

  function loadPreviewPublicEntries() {
    let entries = Array.isArray(community.sampleEntries) ? community.sampleEntries.map((e) => ({ ...e })) : [];
    if (!community.previewMode) entries = [];
    try {
      const raw = localStorage.getItem('bitcoin-bottom-derby-preview-public-entry');
      if (raw) {
        const local = JSON.parse(raw);
        if (local && local.id && !entries.some((e) => e.id === local.id)) entries.push(local);
      }
    } catch (_) {}
    return entries;
  }

  function addPublicEntry(entry) {
    state.publicEntries = (state.publicEntries || []).filter((e) => e.id !== entry.id);
    state.publicEntries.push(entry);
    try { localStorage.setItem('bitcoin-bottom-derby-preview-public-entry', JSON.stringify(entry)); } catch (_) {}
  }

  function loadVerifiedDiscordUser() {
    try {
      const raw = localStorage.getItem('bitcoin-bottom-derby-preview-discord-user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveVerifiedDiscordUser(user) {
    try { localStorage.setItem('bitcoin-bottom-derby-preview-discord-user', JSON.stringify(user)); } catch (_) {}
  }

  function initialsFor(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderVoteLog() {
    if (!isOwnerView()) {
      $('vote-log-panel').textContent = '';
      return;
    }
    const lines = ['BITCOIN BOTTOM DERBY - OWNER VOTE LOG', '--------------------------------------'];
    if (!state.voteLog.length) lines.push('No local votes recorded yet on this device.');
    else state.voteLog.forEach((entry, idx) => { lines.push(`${idx + 1}. ${formatLogDate(entry.ts)} | Discord: ${entry.discordName}`); lines.push(`   Pick: ${entry.racerName} (${entry.racerId}) | Odds at entry: ${entry.oddsAtEntry} | Discord member confirmed: yes`); });
    $('vote-log-panel').textContent = lines.join('\n');
  }

  function renderFooterMetrics() {
    const projected = findRacer(state.finalProjectedWinner);
    $('footer-metrics').innerHTML = `
      <article class="card footer-card trophy"><div class="footer-icon">🏆</div><div><h3>The Golden Bottom Trophy</h3><p>Awarded on October 6 to the call closest to the official Bitcoin contest low.</p><strong>Exact ties become a dead heat.</strong></div></article>
      <article class="card footer-card"><h3>Daily closes completed</h3><div class="big-number">${state.completedDailyCloses} / ${totalDailyCloses()}</div><p>${state.completedDailyCloses === 0 ? 'First daily close pending' : 'Horses step forward after each completed daily candle'}</p></article>
      <article class="card footer-card"><h3>Projected winner if the race ended now</h3><div class="pick-chip"><img src="${projected.avatar}" alt="${projected.name}"><span>${projected.name}</span></div><p>${projected.name} currently has the strongest bookie probability based on distance to target, time left, and crowd pressure.</p></article>
      <article class="card footer-card"><h3>Total bookie tickets</h3><div class="big-number">${totalVoteCount()}</div><p>Discord members only. Owner mode can reveal the administration vote log on approved access.</p></article>`;
  }

  function calculateBookieProbabilities() {
    const low = state.officialLow || state.currentPrice || config.startPrice;
    const daysLeft = Math.max(1, (new Date(config.endDate) - new Date()) / 86400000);
    const sigmaDrop = Math.max(900, low * state.volatility * Math.sqrt(daysLeft) * 0.95 + 600);
    const minTarget = Math.min(...officialRacers.map((r) => r.target));
    const minValue = Math.max(1000, minTarget - 12000);
    const maxValue = low;
    const step = Math.max(120, Math.round((maxValue - minValue) / 420));
    const masses = Object.fromEntries(officialRacers.map((r) => [r.id, 0]));
    for (let x = minValue; x <= maxValue; x += step) {
      const density = Math.exp(-0.5 * Math.pow((maxValue - x) / sigmaDrop, 2));
      let nearest = officialRacers[0];
      let nearestDist = Math.abs(x - officialRacers[0].target);
      for (let i = 1; i < officialRacers.length; i++) {
        const d = Math.abs(x - officialRacers[i].target);
        if (d < nearestDist) { nearestDist = d; nearest = officialRacers[i]; }
      }
      masses[nearest.id] += density;
    }
    if (low > 59000) { masses.tom *= 1.08; masses.tatiana *= 1.08; }
    let sum = Object.values(masses).reduce((a, b) => a + b, 0) || 1;
    let probs = Object.fromEntries(Object.entries(masses).map(([k, v]) => [k, (v / sum) * 100]));
    const totalVotes = totalVoteCount();
    const adjusted = {};
    officialRacers.forEach((r) => {
      const crowdShare = totalVotes ? (state.localVotes[r.id] || 0) / totalVotes : (1 / officialRacers.length);
      adjusted[r.id] = Math.max(1, probs[r.id] * (1 + (crowdShare - (1 / officialRacers.length)) * 0.35));
    });
    sum = Object.values(adjusted).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(Object.entries(adjusted).map(([k, v]) => [k, (v / sum) * 100]));
  }

  function getLiveLeaders() {
    const low = state.officialLow;
    if (low > 59000) return ['tom', 'tatiana'];
    if (low > 47976) return ['tatiana'];
    if (low > 38750) return ['rodster'];
    if (low > 37999) return ['bike'];
    return ['whitesw0n'];
  }

  function liveRankMap() {
    const leaders = getLiveLeaders();
    const map = {};
    if (leaders.length === 2) {
      map.tom = 1; map.tatiana = 1; map.rodster = 3; map.bike = 4; map.whitesw0n = 5;
    } else {
      const lead = leaders[0];
      const order = lead === 'tatiana' ? ['tatiana', 'tom', 'rodster', 'bike', 'whitesw0n']
        : lead === 'rodster' ? ['rodster', 'tatiana', 'tom', 'bike', 'whitesw0n']
        : lead === 'bike' ? ['bike', 'rodster', 'tatiana', 'tom', 'whitesw0n']
        : lead === 'whitesw0n' ? ['whitesw0n', 'bike', 'rodster', 'tatiana', 'tom']
        : ['tom', 'tatiana', 'rodster', 'bike', 'whitesw0n'];
      order.forEach((id, idx) => (map[id] = idx + 1));
    }
    return map;
  }


  function renderCrowds() {
    $('top-crowd').innerHTML = '';
    $('bottom-crowd').innerHTML = '';
  }


  function spectatorMarkup(src, idx, row) {
    const delay = (idx * 0.17).toFixed(2);
    const dur = (2.15 + (idx % 4) * 0.22).toFixed(2);
    const scale = ((row === 'top' ? 0.94 : 0.86) + (idx % 3) * 0.05).toFixed(2);
    return `<div class="crowd-fan row-${row} crowd-${(idx % 4) + 1}" style="--delay:${delay}s;--dur:${dur}s;--scale:${scale}"><img src="${src}" alt="" class="crowd-sprite" draggable="false"></div>`;
  }


  
  function renderFenceSigns() {
    const msDay = 86400000;
    const end = new Date(config.endDate).getTime();
    const now = Date.now();
    const daysRemaining = Math.max(0, Math.ceil((end - now) / msDay));

    const totalDays = totalDailyCloses();
    const baseProgress = Math.min(1, state.completedDailyCloses / Math.max(1, totalDays));
    const rankMap = liveRankMap();
    const advanceByRank = { 1: 0.17, 2: 0.13, 3: 0.10, 4: 0.07, 5: 0.045 };
    const xForId = (id) => {
      const rank = rankMap[id] || 5;
      return Math.min(0.88, 0.16 + baseProgress * 0.42 + (advanceByRank[rank] || 0.045));
    };
    const leaderIds = (state.liveLeaders && state.liveLeaders.length) ? state.liveLeaders : getLiveLeaders();
    const leaderXs = leaderIds.map(xForId);
    const anchorX = leaderXs.length ? leaderXs.reduce((a, b) => a + b, 0) / leaderXs.length : 0.34;

    const weeksLeft = Math.max(1, Math.ceil(daysRemaining / 7));
    const label = daysRemaining > 7
      ? `${weeksLeft} WEEK${weeksLeft === 1 ? '' : 'S'}`
      : (daysRemaining === 7 ? '1 WEEK' : `${Math.max(1, daysRemaining)} DAY${daysRemaining === 1 ? '' : 'S'}`);

    const finishMarkup = daysRemaining <= 7
      ? `<div class="finish-line-marker" aria-hidden="true"><span class="finish-pole pole-left"></span><span class="finish-flag"></span><span class="finish-pole pole-right"></span></div>`
      : '';

    $('fence-signs').innerHTML = `<div class="fence-sign current-marker" style="left:${(anchorX * 100).toFixed(1)}%">${label}</div>${finishMarkup}`;
  }

  function attachVoteToolButtons() {
    const dl = $('download-log-btn');
    const clr = $('clear-local-log-btn');
    if (dl) dl.addEventListener('click', downloadVoteLog);
    if (clr) clr.addEventListener('click', clearVoteLog);
  }

  function downloadVoteLog() {
    if (!isOwnerView()) return alert('Owner-only vote log. Open with your private ownerLog access key to export it.');
    const blob = new Blob([$('vote-log-panel').textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bitcoin-bottom-derby-vote-log.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function clearVoteLog() {
    if (!isOwnerView()) return alert('Owner-only vote log.');
    if (!window.confirm('Clear the locally stored vote log and local pick on this device?')) return;
    localStorage.removeItem(config.betting.voteLogStorageKey);
    localStorage.removeItem(config.betting.voteStorageKey);
    localStorage.removeItem('bitcoin-bottom-derby-discord-name');
    localStorage.removeItem('bitcoin-bottom-derby-preview-discord-user');
    localStorage.removeItem('bitcoin-bottom-derby-preview-public-entry');
    state.voteLog = []; state.userPick = null; state.verifiedUser = null; state.publicEntries = loadPreviewPublicEntries(); render();
  }

  function totalDailyCloses() { return Math.ceil((new Date(config.endDate) - new Date(config.startDate)) / 86400000); }
  function totalVoteCount() { return officialRacers.reduce((sum, r) => sum + (state.localVotes[r.id] || 0), 0); }
  function emptyVoteCounts() { return Object.fromEntries(officialRacers.map((r) => [r.id, 0])); }
  function loadVoteCounts() { try { const raw = localStorage.getItem(config.betting.voteCountsStorageKey); if (raw) return { ...config.betting.seedVotes, ...JSON.parse(raw) }; } catch (_) {} return { ...config.betting.seedVotes }; }
  function saveVoteCounts(votes) { try { localStorage.setItem(config.betting.voteCountsStorageKey, JSON.stringify(votes)); } catch (_) {} }
  function loadVoteLog() { try { const raw = localStorage.getItem(config.betting.voteLogStorageKey); if (raw) return JSON.parse(raw); } catch (_) {} return []; }
  function appendVoteLog(entry) { state.voteLog.push(entry); try { localStorage.setItem(config.betting.voteLogStorageKey, JSON.stringify(state.voteLog)); } catch (_) {} }
  function loadUserPick() { try { return localStorage.getItem(config.betting.voteStorageKey); } catch (_) { return null; } }
  function getSavedDiscordName() { try { return localStorage.getItem('bitcoin-bottom-derby-discord-name') || ''; } catch (_) { return ''; } }
  function saveUserPick(id, discordName) { try { localStorage.setItem(config.betting.voteStorageKey, id); localStorage.setItem('bitcoin-bottom-derby-discord-name', discordName); } catch (_) {} }

  function countdownToNextDailyClose() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(config.dailyCloseHourUtc, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return formatDuration(next - now);
  }

  function tickClock() {
    renderAltHeader();
    const countdownStat = document.querySelector('.stat-card:nth-child(3) .stat-value'); if (countdownStat) countdownStat.textContent = formatCountdownToEnd();
    const closeBell = document.querySelector('.insight-card .accent-text'); if (closeBell) closeBell.textContent = countdownToNextDailyClose();
    const cycle = Math.floor(Date.now() / 12000);
    if (cycle !== state.motionCycle) {
      state.motionCycle = cycle;
      render();
    }
  }

  function simplifyOdds(value) {
    if (!Number.isFinite(value)) return '99/1';
    const rounded = Math.max(1, Math.round(value * 2) / 2);
    if (rounded >= 5) return `${Math.round(rounded)}/1`;
    if (Math.abs(rounded - 0.5) < 0.01) return '1/2';
    if (Math.abs(rounded - 1.5) < 0.01) return '3/2';
    if (Math.abs(rounded - 2.5) < 0.01) return '5/2';
    if (Math.abs(rounded - 3.5) < 0.01) return '7/2';
    if (Math.abs(rounded - 4.5) < 0.01) return '9/2';
    return `${Math.round(rounded)}/1`;
  }

  function formatCountdownToEnd() { return formatDuration(new Date(config.endDate) - new Date()); }
  function formatDuration(ms) { const total = Math.max(0, Math.floor(ms / 1000)); const days = Math.floor(total / 86400); const hours = Math.floor((total % 86400) / 3600); const mins = Math.floor((total % 3600) / 60); const secs = total % 60; if (days > 0) return `${days}d ${hours}h`; return `${hours}h ${mins}m ${secs}s`; }
  function formatCurrency(value) { const num = Number(value) || 0; return num.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  function formatCompact(value) { const num = Number(value) || 0; return num >= 1000 ? `$${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k` : formatCurrency(num); }
  function formatDateShort(dateString) { return new Date(dateString).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }
  function formatLocalTime(date) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function formatLogDate(ts) { return new Date(ts).toLocaleString(); }
  function escapeHtml(str) { return String(str || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function findRacer(id) { return racers.find((r) => r.id === id); }

  init();
})();
