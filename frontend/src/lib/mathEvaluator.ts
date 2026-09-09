/**
 * Safe Mathematical Expression Evaluator
 * Powers the inline calculator in the Command Palette / Quick Runner.
 * Implements a recursive descent parser for arithmetic without using eval() or Function().
 */

export interface MathEvalResult {
  expression: string;
  result: number;
  formatted: string;
}

export function evaluateMathExpression(rawInput: string): MathEvalResult | null {
  if (!rawInput) return null;
  let expr = rawInput.trim();

  // Handle "X% of Y" pattern (e.g. "15% of 200" -> "(15 / 100) * 200")
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:\.\d+)?)/gi, '($1 / 100) * $2');
  // Handle trailing % (e.g. "25%" -> "(25 / 100)")
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');
  // Replace power ^ with **
  expr = expr.replace(/\^/g, '**');

  // Fast check: Must contain at least one digit and one math operator or known math function
  if (!/\d/.test(expr)) return null;
  const hasOperator = /[+\-*/^]/.test(expr) || /^(?:sqrt|abs|round|sin|cos|tan)\(/i.test(expr);
  if (!hasOperator) return null;

  // Verify only allowed characters: digits, decimal, operators, parentheses, spaces, and math function names
  const sanitized = expr.replace(/\b(sqrt|abs|round|sin|cos|tan|pi|e)\b/gi, '');
  if (!/^[0-9+\-*/().\s*]+$/.test(sanitized)) {
    return null;
  }

  try {
    const result = evaluateTokens(tokenize(expr));
    if (result === null || !isFinite(result) || isNaN(result)) {
      return null;
    }

    // Format output cleanly (strip excessive floating point precision like 0.30000000000000004)
    const rounded = Math.round(result * 1e10) / 1e10;
    const formatted = rounded.toLocaleString('uk-UA', { maximumFractionDigits: 6 });

    return {
      expression: rawInput.trim(),
      result: rounded,
      formatted,
    };
  } catch {
    return null;
  }
}

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN' | 'FUNC' | 'CONST';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const str = input.toLowerCase();

  while (i < str.length) {
    const char = str[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(str[i + 1] || ''))) {
      let numStr = '';
      while (i < str.length && (/[\d.]/.test(str[i]))) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (char === '*' && str[i + 1] === '*') {
      tokens.push({ type: 'OP', value: '**' });
      i += 2;
      continue;
    }

    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'OP', value: char });
      i++;
      continue;
    }

    // Check functions or constants
    const wordMatch = str.slice(i).match(/^[a-z]+/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (['sqrt', 'abs', 'round', 'sin', 'cos', 'tan'].includes(word)) {
        tokens.push({ type: 'FUNC', value: word });
        i += word.length;
        continue;
      }
      if (word === 'pi') {
        tokens.push({ type: 'CONST', value: String(Math.PI) });
        i += word.length;
        continue;
      }
      if (word === 'e') {
        tokens.push({ type: 'CONST', value: String(Math.E) });
        i += word.length;
        continue;
      }
    }

    // Unrecognized character
    throw new Error('Unexpected character: ' + char);
  }

  return tokens;
}

/**
 * Recursive descent parser:
 * expr   := term (('+' | '-') term)*
 * term   := power (('*' | '/') power)*
 * power  := factor ('**' power)?
 * factor := ('+' | '-')? (NUMBER | CONST | FUNC '(' expr ')' | '(' expr ')')
 */
function evaluateTokens(tokens: Token[]): number {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(expectedType?: TokenType, expectedValue?: string): Token {
    const token = tokens[pos];
    if (!token) throw new Error('Unexpected end of input');
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected token type ${expectedType}, got ${token.type}`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Expected value ${expectedValue}, got ${token.value}`);
    }
    pos++;
    return token;
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() && peek()!.type === 'OP' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume('OP').value;
      const right = parseTerm();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() && peek()!.type === 'OP' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume('OP').value;
      const right = parsePower();
      if (op === '*') left *= right;
      else {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
    }
    return left;
  }

  function parsePower(): number {
    let base = parseFactor();
    if (peek() && peek()!.type === 'OP' && peek()!.value === '**') {
      consume('OP', '**');
      const exp = parsePower(); // right-associative
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseFactor(): number {
    const token = peek();
    if (!token) throw new Error('Unexpected end of input');

    // Unary plus or minus
    if (token.type === 'OP' && (token.value === '+' || token.value === '-')) {
      const op = consume('OP').value;
      const factor = parseFactor();
      return op === '-' ? -factor : factor;
    }

    if (token.type === 'NUMBER' || token.type === 'CONST') {
      consume();
      return parseFloat(token.value);
    }

    if (token.type === 'FUNC') {
      const funcName = consume('FUNC').value;
      consume('LPAREN', '(');
      const arg = parseExpr();
      consume('RPAREN', ')');

      switch (funcName) {
        case 'sqrt': return Math.sqrt(arg);
        case 'abs': return Math.abs(arg);
        case 'round': return Math.round(arg);
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        default: return arg;
      }
    }

    if (token.type === 'LPAREN') {
      consume('LPAREN', '(');
      const val = parseExpr();
      consume('RPAREN', ')');
      return val;
    }

    throw new Error('Unexpected token: ' + token.value);
  }

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new Error('Extra tokens after expression');
  }
  return result;
}
