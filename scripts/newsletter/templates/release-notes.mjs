import React from 'react';

function bodyStyle() {
  return {
    margin: 0,
    padding: '24px',
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontFamily: "'Courier New', Courier, monospace",
  };
}

function shellStyle() {
  return {
    margin: '0 auto',
    maxWidth: '680px',
    borderRadius: '12px',
    border: '1px solid #d4d4d8',
    padding: '24px',
    backgroundColor: '#ffffff',
  };
}

export const releaseNotesTemplate = {
  key: 'release-notes',
  label: 'Release Notes',
  defaultSubject: 'Dex Notes release',
  defaultPreheader: 'New entries, fixes, and updates this week',
  defaultVariables: {
    headline: 'Dex Notes release',
    releaseLabel: 'Issue #001',
    intro: 'This release contains updates across catalog, routing reliability, and member tooling.',
    items: [
      { title: 'Catalog', detail: 'Added deep favorites support and parity fixes.' },
      { title: 'Support', detail: 'Shipped industrial error/support routes with status resilience.' },
      { title: 'Messages', detail: 'Unified inbox for submissions and system notifications.' },
    ],
    ctaLabel: 'Open Dex Notes',
    ctaHref: 'https://dexdsl.github.io/dex-notes/',
    unsubscribeUrl: '{{unsubscribeUrl}}',
  },
  render({ variables }) {
    const headline = String(variables.headline || 'Dex Notes release').trim();
    const releaseLabel = String(variables.releaseLabel || '').trim();
    const intro = String(variables.intro || '').trim();
    const items = Array.isArray(variables.items) ? variables.items : [];
    const ctaLabel = String(variables.ctaLabel || 'Open Dex Notes').trim();
    const ctaHref = String(variables.ctaHref || 'https://dexdsl.github.io/dex-notes/').trim();
    const unsubscribeUrl = String(variables.unsubscribeUrl || '{{unsubscribeUrl}}').trim();

    return React.createElement(
      'html',
      { lang: 'en' },
      React.createElement(
        'body',
        { style: bodyStyle() },
        React.createElement(
          'section',
          { style: shellStyle() },
          React.createElement('p', { style: { margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' } }, 'DEX NOTES RELEASE'),
          React.createElement('h1', { style: { margin: '0 0 6px 0', fontSize: '28px', lineHeight: 1.15 } }, headline),
          releaseLabel ? React.createElement('p', { style: { margin: '0 0 14px 0', fontSize: '14px', color: '#4b5563' } }, releaseLabel) : null,
          intro ? React.createElement('p', { style: { margin: '0 0 18px 0', fontSize: '15px', lineHeight: 1.5 } }, intro) : null,
          React.createElement(
            'ul',
            { style: { margin: '0 0 20px 0', paddingLeft: '18px' } },
            ...items.map((item, index) => React.createElement(
              'li',
              { key: `${String(item?.title || 'item')}-${index}`, style: { marginBottom: '10px' } },
              React.createElement('strong', null, String(item?.title || 'Update').trim()),
              ': ',
              String(item?.detail || '').trim(),
            )),
          ),
          React.createElement(
            'p',
            { style: { margin: '0 0 22px 0' } },
            React.createElement(
              'a',
              {
                href: ctaHref,
                style: {
                  display: 'inline-block',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #111827',
                  textDecoration: 'none',
                  color: '#111827',
                  fontWeight: 700,
                },
              },
              ctaLabel,
            ),
          ),
          React.createElement('hr', { style: { border: 0, borderTop: '1px solid #e4e4e7', margin: '0 0 14px 0' } }),
          React.createElement('p', { style: { margin: 0, fontSize: '12px', color: '#52525b' } },
            'Manage your subscription: ',
            React.createElement('a', { href: unsubscribeUrl, style: { color: '#111827' } }, unsubscribeUrl),
          ),
        ),
      ),
    );
  },
  renderText(variables) {
    const headline = String(variables.headline || 'Dex Notes release').trim();
    const releaseLabel = String(variables.releaseLabel || '').trim();
    const intro = String(variables.intro || '').trim();
    const items = Array.isArray(variables.items) ? variables.items : [];
    const ctaLabel = String(variables.ctaLabel || 'Open Dex Notes').trim();
    const ctaHref = String(variables.ctaHref || 'https://dexdsl.github.io/dex-notes/').trim();
    const unsubscribeUrl = String(variables.unsubscribeUrl || '{{unsubscribeUrl}}').trim();

    const lines = [headline, releaseLabel, '', intro, ''];
    items.forEach((item) => {
      lines.push(`- ${String(item?.title || 'Update').trim()}: ${String(item?.detail || '').trim()}`);
    });
    lines.push('', `${ctaLabel}: ${ctaHref}`, '', `Manage your subscription: ${unsubscribeUrl}`);
    return lines.filter(Boolean).join('\n');
  },
};
