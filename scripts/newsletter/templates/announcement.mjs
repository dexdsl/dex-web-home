import React from 'react';

function bodyStyle() {
  return {
    margin: 0,
    padding: '24px',
    backgroundColor: '#f4f4f5',
    color: '#111827',
    fontFamily: "'Courier New', Courier, monospace",
  };
}

function cardStyle() {
  return {
    margin: '0 auto',
    maxWidth: '620px',
    borderRadius: '12px',
    border: '1px solid #e4e4e7',
    padding: '24px',
    backgroundColor: '#ffffff',
  };
}

export const announcementTemplate = {
  key: 'announcement',
  label: 'Announcement',
  defaultSubject: 'Dex announcement',
  defaultPreheader: 'Latest Dex update from the Dex team',
  defaultVariables: {
    headline: 'Dex announcement',
    intro: 'We shipped a new update in Dex and wanted to share it with you first.',
    body: 'Review the details, then jump into Dex Notes for the full breakdown and links.',
    ctaLabel: 'Read Dex Notes',
    ctaHref: 'https://dexdsl.github.io/dex-notes/',
    unsubscribeUrl: '{{unsubscribeUrl}}',
  },
  render({ variables }) {
    const headline = String(variables.headline || 'Dex announcement').trim();
    const intro = String(variables.intro || '').trim();
    const body = String(variables.body || '').trim();
    const ctaLabel = String(variables.ctaLabel || 'Read Dex Notes').trim();
    const ctaHref = String(variables.ctaHref || 'https://dexdsl.github.io/dex-notes/').trim();
    const unsubscribeUrl = String(variables.unsubscribeUrl || '{{unsubscribeUrl}}').trim();

    return React.createElement(
      'html',
      { lang: 'en' },
      React.createElement(
        'body',
        { style: bodyStyle() },
        React.createElement(
          'main',
          { style: cardStyle() },
          React.createElement('p', { style: { margin: '0 0 8px 0', letterSpacing: '0.08em', fontSize: '12px', textTransform: 'uppercase', color: '#71717a' } }, 'DEX NEWSLETTER'),
          React.createElement('h1', { style: { margin: '0 0 16px 0', fontSize: '30px', lineHeight: 1.1 } }, headline),
          intro ? React.createElement('p', { style: { margin: '0 0 12px 0', fontSize: '15px', lineHeight: 1.5 } }, intro) : null,
          body ? React.createElement('p', { style: { margin: '0 0 22px 0', fontSize: '15px', lineHeight: 1.5 } }, body) : null,
          React.createElement(
            'p',
            { style: { margin: '0 0 24px 0' } },
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
          React.createElement('hr', { style: { border: 0, borderTop: '1px solid #e4e4e7', margin: '0 0 16px 0' } }),
          React.createElement('p', { style: { margin: 0, fontSize: '12px', color: '#52525b' } },
            'Manage your subscription: ',
            React.createElement('a', { href: unsubscribeUrl, style: { color: '#111827' } }, unsubscribeUrl),
          ),
        ),
      ),
    );
  },
  renderText(variables) {
    const headline = String(variables.headline || 'Dex announcement').trim();
    const intro = String(variables.intro || '').trim();
    const body = String(variables.body || '').trim();
    const ctaLabel = String(variables.ctaLabel || 'Read Dex Notes').trim();
    const ctaHref = String(variables.ctaHref || 'https://dexdsl.github.io/dex-notes/').trim();
    const unsubscribeUrl = String(variables.unsubscribeUrl || '{{unsubscribeUrl}}').trim();
    return [
      headline,
      '',
      intro,
      '',
      body,
      '',
      `${ctaLabel}: ${ctaHref}`,
      '',
      `Manage your subscription: ${unsubscribeUrl}`,
    ].filter(Boolean).join('\n');
  },
};
