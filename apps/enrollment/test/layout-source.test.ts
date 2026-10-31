import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

/**
 * Static layout lint. React Native lays out every View as a flexbox, and a Text placed
 * in a `flex-row` keeps its intrinsic width unless it may shrink — that is how text ends
 * up drawn past its card or button. This parses every screen and component and checks
 * the three rules that keep boxes tidy: text in rows can shrink, one corner radius, one
 * padding scale.
 */
const appRoot = path.join(import.meta.dirname, '..');

function tsx(relativeDir: string): string[] {
  return readdirSync(path.join(appRoot, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return tsx(relativePath);
    return entry.name.endsWith('.tsx') ? [relativePath] : [];
  });
}

const files = [...tsx('app'), ...tsx('src/components')];
const TEXT_TAGS = new Set(['Text', 'StatusText']);

function tagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
}

function attributes(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  return (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties;
}

/** Every class token written in a className-like attribute, including inside cn(...). */
function classTokens(node: ts.JsxElement | ts.JsxSelfClosingElement, attribute = /^(className|contentContainerClassName)$/): string[] {
  const tokens: string[] = [];
  for (const property of attributes(node)) {
    if (!ts.isJsxAttribute(property) || !attribute.test(property.name.getText()) || !property.initializer) continue;
    const visit = (child: ts.Node) => {
      if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) tokens.push(...child.text.split(/\s+/).filter(Boolean));
      ts.forEachChild(child, visit);
    };
    visit(property.initializer);
  }
  return tokens;
}

function jsxElements(file: string): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
  const sourceFile = ts.createSourceFile(file, readFileSync(path.join(appRoot, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function directChildren(node: ts.JsxElement): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
  const children: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
  const collect = (child: ts.Node) => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) children.push(child);
    else if (ts.isJsxFragment(child)) child.children.forEach(collect);
    else if (ts.isJsxExpression(child) && child.expression) collectExpression(child.expression);
  };
  // Conditionals like {x ? <Text/> : null} still place the Text in the row.
  const collectExpression = (expression: ts.Node) => {
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) collect(expression);
    else if (ts.isConditionalExpression(expression)) { collectExpression(expression.whenTrue); collectExpression(expression.whenFalse); }
    else if (ts.isBinaryExpression(expression)) collectExpression(expression.right);
    else if (ts.isParenthesizedExpression(expression)) collectExpression(expression.expression);
  };
  node.children.forEach(collect);
  return children;
}

test('text placed in a row can always shrink, so it wraps inside its box', () => {
  const problems: string[] = [];
  for (const file of files) {
    for (const element of jsxElements(file)) {
      if (!ts.isJsxElement(element) || !classTokens(element).includes('flex-row')) continue;
      for (const child of directChildren(element)) {
        if (!TEXT_TAGS.has(tagName(child))) continue;
        const tokens = classTokens(child);
        if (!tokens.some((token) => token === 'flex-1' || token === 'shrink')) {
          problems.push(`${file}: <${tagName(child)}> "${child.getText().slice(0, 60)}" in a flex-row has neither flex-1 nor shrink`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('a view holding text inside a row can shrink or has a fixed width', () => {
  const holdsText = (node: ts.Node): boolean =>
    ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && TEXT_TAGS.has(tagName(node))) || ts.forEachChild(node, holdsText) === true;
  const problems: string[] = [];
  for (const file of files) {
    for (const element of jsxElements(file)) {
      if (!ts.isJsxElement(element) || !classTokens(element).includes('flex-row')) continue;
      for (const child of directChildren(element)) {
        if (tagName(child) !== 'View' || !ts.isJsxElement(child) || !child.children.some(holdsText)) continue;
        const tokens = classTokens(child);
        if (!tokens.some((token) => token === 'flex-1' || token === 'shrink' || /^w-(\d|\[)/.test(token))) {
          problems.push(`${file}: <View className="${tokens.join(' ')}"> holds text in a flex-row but cannot shrink`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('button labels shrink and centre so long labels stay inside the button', () => {
  const button = readFileSync(path.join(appRoot, 'src/components/ui/button.tsx'), 'utf8');
  assert.match(button, /'text-foreground shrink text-center text-base font-medium'/);
});

test('every box uses the one corner radius (nested media one step smaller)', () => {
  const allowed = new Set(['rounded-lg', 'rounded-md', 'rounded-full', 'rounded-none']);
  const problems: string[] = [];
  for (const file of files) {
    const code = readFileSync(path.join(appRoot, file), 'utf8');
    for (const match of code.matchAll(/\brounded(?:-[a-z0-9[\]%]+)?\b/g)) {
      if (!allowed.has(match[0])) problems.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(problems, []);
});

const BOX_TAGS = new Set(['Alert', 'Button', 'Card', 'CardContent', 'Input', 'Textarea']);

function isBox(element: ts.JsxElement | ts.JsxSelfClosingElement, tokens: string[]) {
  return BOX_TAGS.has(tagName(element)) || tokens.some((token) => token === 'border' || token.startsWith('bg-'));
}

test('boxes share one padding scale: 16pt sides, never lopsided', () => {
  // px-5 is the page gutter, used only by the screen shell and the ticket list container.
  const gutterFiles = new Set([path.join('src', 'components', 'screen-shell.tsx'), path.join('app', 'tickets.tsx')]);
  const problems: string[] = [];
  for (const file of files) {
    for (const element of jsxElements(file)) {
      const tokens = classTokens(element);
      for (const token of tokens) {
        const match = /^(p[xytrbl]?)-(\d+(?:\.\d+)?)$/.exec(token);
        if (!match) continue;
        const [, axis, size] = match;
        if ((axis === 'px' || axis === 'p') && size !== '4' && size !== '0' && !(token === 'px-5' && gutterFiles.has(file))) {
          problems.push(`${file}: <${tagName(element)}> off-scale horizontal ${token}`);
        }
        if (isBox(element, tokens) && ['pl', 'pr', 'pt', 'pb'].includes(axis!)) {
          problems.push(`${file}: <${tagName(element)}> box has lopsided ${token}`);
        }
      }
    }
  }
  // The primitives themselves follow the same scale.
  for (const file of tsx('src/components/ui')) {
    for (const match of readFileSync(path.join(appRoot, file), 'utf8').matchAll(/(?<![\w:-])(p[xlr]?)-(\d+(?:\.\d+)?)\b/g)) {
      if (match[2] !== '4' && match[2] !== '0') problems.push(`${file}: off-scale ${match[0]}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every input-like control is 44pt tall with 16pt side padding and the shared radius', () => {
  const input = readFileSync(path.join(appRoot, 'src/components/ui/input.tsx'), 'utf8');
  const textarea = readFileSync(path.join(appRoot, 'src/components/ui/textarea.tsx'), 'utf8');
  const button = readFileSync(path.join(appRoot, 'src/components/ui/button.tsx'), 'utf8');
  const card = readFileSync(path.join(appRoot, 'src/components/ui/card.tsx'), 'utf8');
  const alert = readFileSync(path.join(appRoot, 'src/components/ui/alert.tsx'), 'utf8');

  for (const [name, code] of [['input', input], ['textarea', textarea], ['button', button], ['card', card], ['alert', alert]] as const) {
    assert.match(code, /rounded-lg/, `${name} radius`);
  }
  assert.match(input, /h-11 [^']*px-4/);
  assert.doesNotMatch(input, /leading-/, 'single-line inputs must not set a line height');
  assert.match(textarea, /px-4 py-3/);
  assert.match(alert, /px-4 py-3/);
  assert.match(button, /default: 'h-11 px-4'/);
});
