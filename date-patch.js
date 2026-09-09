(() => {
  const replacements = [
    ['October 6, 2026', 'November 3, 2026'],
    ['Oct 6, 2026', 'Nov 3, 2026'],
    ['October 6', 'November 3'],
    ['Oct 6', 'Nov 3']
  ];

  function patchFinishDate(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      let text = node.nodeValue || '';
      const original = text;
      replacements.forEach(([from, to]) => {
        text = text.split(from).join(to);
      });
      if (text !== original) node.nodeValue = text;
    });
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchFinishDate();
    });
  });

  const start = () => {
    patchFinishDate();
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
