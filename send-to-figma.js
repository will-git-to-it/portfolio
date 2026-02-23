#!/usr/bin/env node

/**
 * send-to-figma.js
 *
 * Sends this portfolio's design tokens to a Figma file using the Figma
 * REST Variables API (POST /v1/files/:file_key/variables).
 *
 * The script creates three variable collections:
 *   • Colors  – dark & light mode values for every CSS custom property
 *   • Typography – font families, sizes, weights, line-heights, letter-spacing
 *   • Spacing  – a shared spacing/radius scale
 *
 * Prerequisites
 * -------------
 *   node >= 18  (uses built-in fetch)
 *
 * Usage
 * -----
 *   FIGMA_TOKEN=<personal-access-token> \
 *   FIGMA_FILE_KEY=<file-key> \
 *   node send-to-figma.js
 *
 * The file key is the string in the Figma URL between /file/ and /
 *   e.g. https://www.figma.com/file/XXXXXXXXXXXXXX/My-Portfolio
 *                                    ^^^^^^^^^^^^^^
 */

'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN    = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;

if (!TOKEN || !FILE_KEY) {
  console.error(
    'Error: set FIGMA_TOKEN and FIGMA_FILE_KEY environment variables before running.\n\n' +
    '  FIGMA_TOKEN=<pat> FIGMA_FILE_KEY=<key> node send-to-figma.js\n\n' +
    'Your Personal Access Token can be created at:\n' +
    '  Figma → Account Settings → Personal access tokens\n'
  );
  process.exit(1);
}

// ─── Design tokens ───────────────────────────────────────────────────────────

/**
 * Colours extracted from the CSS custom properties in index.html.
 *
 * Dark theme  = :root
 * Light theme = body.inverted-theme
 */
const COLORS = {
  background: { dark: '#002F21', light: '#EDEDE1' },
  text:       { dark: '#FFFFFF', light: '#002F21' },
  textLight:  { dark: '#EDEDE1', light: '#1a3d33' },
  accent:     { dark: '#7cc9a8', light: '#00875a' },
  border:     { dark: '#2d5550', light: '#c5c5b8' },
};

/**
 * One-off colours that appear as literals in the CSS (not via custom props).
 * These get a single value (no mode split).
 */
const COLORS_FIXED = {
  cardGradientStart: '#2d5550',
  cardGradientEnd:   '#1f4440',
};

/** Typography scale */
const TYPOGRAPHY = {
  fontFamily: {
    sans:  'Mint Grotesk',
    serif: 'Tartuffo',
  },
  fontSize: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 64,
  },
  fontWeight: {
    thin:      100,
    light:     300,
    regular:   400,
    medium:    500,
    bold:      700,
    extraBold: 800,
    black:     900,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.7,
  },
  letterSpacing: {
    tight: -0.02,
  },
};

/** Spacing & border-radius scale (px) */
const SPACING = {
  spacing: {
    xs:    4,
    sm:    8,
    md:   16,
    lg:   24,
    xl:   40,
    '2xl': 46,   // 2.85rem header padding
    '3xl': 64,
    '4xl': 96,
    '5xl': 128,
    '6xl': 192,  // 12rem section top padding
  },
  borderRadius: {
    sm:   6,
    md:   8,
    lg:  14,
    full: 9999,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a hex colour string to a Figma RGBA object (0–1 range). */
function hexToFigmaRgba(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

/** POST to the Figma REST API. */
async function figmaPost(path, body) {
  const url = `https://api.figma.com/v1${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Figma-Token': TOKEN,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      `Figma API error ${res.status}: ${JSON.stringify(json, null, 2)}`
    );
  }
  return json;
}

// ─── Build the payload ───────────────────────────────────────────────────────

/**
 * Build the complete variables payload accepted by
 * POST /v1/files/{file_key}/variables
 *
 * Figma's bulk endpoint accepts:
 *   variableCollections – collection definitions with mode IDs
 *   variableModes       – modes (dark / light / default)
 *   variables           – variable definitions (name, type, collection)
 *   variableModeValues  – actual values per variable per mode
 */
function buildPayload() {
  const variableCollections = [];
  const variableModes       = [];
  const variables           = [];
  const variableModeValues  = [];

  // ── 1. COLORS collection (two modes: Dark / Light) ──────────────────────

  const colorsCollId   = 'vc-colors';
  const darkModeId     = 'vm-dark';
  const lightModeId    = 'vm-light';
  const fixedModeId    = 'vm-fixed';

  variableCollections.push({
    action:          'CREATE',
    id:              colorsCollId,
    name:            'Colors',
    initialModeId:   darkModeId,
  });

  variableModes.push(
    { action: 'CREATE', id: darkModeId,  name: 'Dark',  variableCollectionId: colorsCollId },
    { action: 'CREATE', id: lightModeId, name: 'Light', variableCollectionId: colorsCollId }
  );

  // Themed colours (dark + light values)
  for (const [name, { dark, light }] of Object.entries(COLORS)) {
    const varId = `var-color-${name}`;
    variables.push({
      action:               'CREATE',
      id:                   varId,
      name:                 `color/${name}`,
      variableCollectionId: colorsCollId,
      resolvedType:         'COLOR',
    });
    variableModeValues.push(
      { variableId: varId, modeId: darkModeId,  value: hexToFigmaRgba(dark)  },
      { variableId: varId, modeId: lightModeId, value: hexToFigmaRgba(light) }
    );
  }

  // Fixed colours (single value, stored under Dark mode)
  for (const [name, hex] of Object.entries(COLORS_FIXED)) {
    const varId = `var-color-fixed-${name}`;
    variables.push({
      action:               'CREATE',
      id:                   varId,
      name:                 `color/fixed/${name}`,
      variableCollectionId: colorsCollId,
      resolvedType:         'COLOR',
    });
    variableModeValues.push(
      { variableId: varId, modeId: darkModeId,  value: hexToFigmaRgba(hex) },
      { variableId: varId, modeId: lightModeId, value: hexToFigmaRgba(hex) }
    );
  }

  // ── 2. TYPOGRAPHY collection (single mode) ───────────────────────────────

  const typoCollId   = 'vc-typography';
  const typoModeId   = 'vm-typo-default';

  variableCollections.push({
    action:        'CREATE',
    id:            typoCollId,
    name:          'Typography',
    initialModeId: typoModeId,
  });

  variableModes.push({
    action: 'CREATE', id: typoModeId, name: 'Default', variableCollectionId: typoCollId,
  });

  // Font families (STRING)
  for (const [key, value] of Object.entries(TYPOGRAPHY.fontFamily)) {
    const varId = `var-typo-family-${key}`;
    variables.push({
      action: 'CREATE', id: varId,
      name: `typography/fontFamily/${key}`,
      variableCollectionId: typoCollId,
      resolvedType: 'STRING',
    });
    variableModeValues.push({ variableId: varId, modeId: typoModeId, value });
  }

  // Font sizes (FLOAT, px)
  for (const [key, value] of Object.entries(TYPOGRAPHY.fontSize)) {
    const varId = `var-typo-size-${key}`;
    variables.push({
      action: 'CREATE', id: varId,
      name: `typography/fontSize/${key}`,
      variableCollectionId: typoCollId,
      resolvedType: 'FLOAT',
    });
    variableModeValues.push({ variableId: varId, modeId: typoModeId, value });
  }

  // Font weights (FLOAT)
  for (const [key, value] of Object.entries(TYPOGRAPHY.fontWeight)) {
    const varId = `var-typo-weight-${key}`;
    variables.push({
      action: 'CREATE', id: varId,
      name: `typography/fontWeight/${key}`,
      variableCollectionId: typoCollId,
      resolvedType: 'FLOAT',
    });
    variableModeValues.push({ variableId: varId, modeId: typoModeId, value });
  }

  // Line heights (FLOAT)
  for (const [key, value] of Object.entries(TYPOGRAPHY.lineHeight)) {
    const varId = `var-typo-lh-${key}`;
    variables.push({
      action: 'CREATE', id: varId,
      name: `typography/lineHeight/${key}`,
      variableCollectionId: typoCollId,
      resolvedType: 'FLOAT',
    });
    variableModeValues.push({ variableId: varId, modeId: typoModeId, value });
  }

  // Letter spacing (FLOAT)
  for (const [key, value] of Object.entries(TYPOGRAPHY.letterSpacing)) {
    const varId = `var-typo-ls-${key}`;
    variables.push({
      action: 'CREATE', id: varId,
      name: `typography/letterSpacing/${key}`,
      variableCollectionId: typoCollId,
      resolvedType: 'FLOAT',
    });
    variableModeValues.push({ variableId: varId, modeId: typoModeId, value });
  }

  // ── 3. SPACING collection (single mode) ─────────────────────────────────

  const spacingCollId = 'vc-spacing';
  const spacingModeId = 'vm-spacing-default';

  variableCollections.push({
    action: 'CREATE', id: spacingCollId, name: 'Spacing', initialModeId: spacingModeId,
  });

  variableModes.push({
    action: 'CREATE', id: spacingModeId, name: 'Default', variableCollectionId: spacingCollId,
  });

  for (const [group, tokens] of Object.entries(SPACING)) {
    for (const [key, value] of Object.entries(tokens)) {
      const varId = `var-spacing-${group}-${key}`;
      variables.push({
        action: 'CREATE', id: varId,
        name: `${group}/${key}`,
        variableCollectionId: spacingCollId,
        resolvedType: 'FLOAT',
      });
      variableModeValues.push({ variableId: varId, modeId: spacingModeId, value });
    }
  }

  return { variableCollections, variableModes, variables, variableModeValues };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sending design tokens to Figma file ${FILE_KEY} …\n`);

  const payload = buildPayload();

  console.log(
    `  Collections : ${payload.variableCollections.length}\n` +
    `  Modes       : ${payload.variableModes.length}\n` +
    `  Variables   : ${payload.variables.length}\n` +
    `  Values      : ${payload.variableModeValues.length}\n`
  );

  try {
    const result = await figmaPost(`/files/${FILE_KEY}/variables`, payload);
    console.log('Done! Variables created successfully.\n');

    // Surface the IDs Figma assigned to our collections
    if (result.meta?.variableCollections) {
      console.log('Created collections:');
      for (const [id, col] of Object.entries(result.meta.variableCollections)) {
        console.log(`  ${col.name}  →  ${id}`);
      }
    }
  } catch (err) {
    console.error('Failed to push to Figma:\n', err.message);
    process.exit(1);
  }
}

main();
