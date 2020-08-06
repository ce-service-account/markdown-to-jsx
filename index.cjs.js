'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* @jsx h */
/**
 * markdown-to-jsx@6 is a fork of [simple-markdown v0.2.2](https://github.com/Khan/simple-markdown)
 * from Khan Academy. Thank you Khan devs for making such an awesome and extensible
 * parsing infra... without it, half of the optimizations here wouldn't be feasible. 🙏🏼
 */


exports.compiler = compiler;
exports.default = Markdown;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _unquote = require('unquote');

var _unquote2 = _interopRequireDefault(_unquote);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

/** TODO: Drop for React 16? */
var ATTRIBUTE_TO_JSX_PROP_MAP = {
    accesskey: 'accessKey',
    allowfullscreen: 'allowFullScreen',
    allowtransparency: 'allowTransparency',
    autocomplete: 'autoComplete',
    autofocus: 'autoFocus',
    autoplay: 'autoPlay',
    cellpadding: 'cellPadding',
    cellspacing: 'cellSpacing',
    charset: 'charSet',
    class: 'className',
    classid: 'classId',
    colspan: 'colSpan',
    contenteditable: 'contentEditable',
    contextmenu: 'contextMenu',
    crossorigin: 'crossOrigin',
    enctype: 'encType',
    for: 'htmlFor',
    formaction: 'formAction',
    formenctype: 'formEncType',
    formmethod: 'formMethod',
    formnovalidate: 'formNoValidate',
    formtarget: 'formTarget',
    frameborder: 'frameBorder',
    hreflang: 'hrefLang',
    inputmode: 'inputMode',
    keyparams: 'keyParams',
    keytype: 'keyType',
    marginheight: 'marginHeight',
    marginwidth: 'marginWidth',
    maxlength: 'maxLength',
    mediagroup: 'mediaGroup',
    minlength: 'minLength',
    novalidate: 'noValidate',
    radiogroup: 'radioGroup',
    readonly: 'readOnly',
    rowspan: 'rowSpan',
    spellcheck: 'spellCheck',
    srcdoc: 'srcDoc',
    srclang: 'srcLang',
    srcset: 'srcSet',
    tabindex: 'tabIndex',
    usemap: 'useMap'
};

var DO_NOT_PROCESS_HTML_ELEMENTS = ['style', 'script'];

/**
 * the attribute extractor regex looks for a valid attribute name,
 * followed by an equal sign (whitespace around the equal sign is allowed), followed
 * by one of the following:
 *
 * 1. a single quote-bounded string, e.g. 'foo'
 * 2. a double quote-bounded string, e.g. "bar"
 * 3. an interpolation, e.g. {something}
 *
 * JSX can be be interpolated into itself and is passed through the compiler using
 * the same options and setup as the current run.
 *
 * <Something children={<SomeOtherThing />} />
 *                      ==================
 *                              ↳ children: [<SomeOtherThing />]
 *
 * Otherwise, interpolations are handled as strings or simple booleans
 * unless HTML syntax is detected.
 *
 * <Something color={green} disabled={true} />
 *                   =====            ====
 *                     ↓                ↳ disabled: true
 *                     ↳ color: "green"
 *
 * Numbers are not parsed at this time due to complexities around int, float,
 * and the upcoming bigint functionality that would make handling it unwieldy.
 * Parse the string in your component as desired.
 *
 * <Something someBigNumber={123456789123456789} />
 *                           ==================
 *                                   ↳ someBigNumber: "123456789123456789"
 */
var ATTR_EXTRACTOR_R = /([-A-Z0-9_:]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|(?:\{((?:\\.|{[^}]*?}|[^}])*)\})))?/gi;

/** TODO: Write explainers for each of these */

var AUTOLINK_MAILTO_CHECK_R = /mailto:/i;
var BLOCK_END_R = /\n{2,}$/;
var BLOCKQUOTE_R = /^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/;
var BLOCKQUOTE_TRIM_LEFT_MULTILINE_R = /^ *> ?/gm;
var BREAK_LINE_R = /^ {2,}\n/;
var BREAK_THEMATIC_R = /^(?:( *[-*_]) *){3,}(?:\n *)+\n/;
var CODE_BLOCK_FENCED_R = /^\s*(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n?/;
var CODE_BLOCK_R = /^(?: {4}[^\n]+\n*)+(?:\n *)+\n?/;
var CODE_INLINE_R = /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/;
var CONSECUTIVE_NEWLINE_R = /^(?:\n *)*\n/;
var CR_NEWLINE_R = /\r\n?/g;
var FOOTNOTE_R = /^\[\^(.*)\](:.*)\n/;
var FOOTNOTE_REFERENCE_R = /^\[\^(.*)\]/;
var FORMFEED_R = /\f/g;
var GFM_TASK_R = /^\s*?\[(x|\s)\]/;
var HEADING_R = /^ *(#{1,6}) *([^\n]+)\n{0,2}/;
var HEADING_SETEXT_R = /^([^\n]+)\n *(=|-){3,} *(?:\n *)+\n/;

/**
 * Explanation:
 *
 * 1. Look for a starting tag, preceeded by any amount of spaces
 *    ^ *<
 *
 * 2. Capture the tag name (capture 1)
 *    ([^ >/]+)
 *
 * 3. Ignore a space after the starting tag and capture the attribute portion of the tag (capture 2)
 *     ?([^>]*)\/{0}>
 *
 * 4. Ensure a matching closing tag is present in the rest of the input string
 *    (?=[\s\S]*<\/\1>)
 *
 * 5. Capture everything until the matching closing tag -- this might include additional pairs
 *    of the same tag type found in step 2 (capture 3)
 *    ((?:[\s\S]*?(?:<\1[^>]*>[\s\S]*?<\/\1>)*[\s\S]*?)*?)<\/\1>
 *
 * 6. Capture excess newlines afterward
 *    \n*
 */ //^ SPACE <TAGNAME       ATTRS    />  NEWLINE
var HTML_BLOCK_ELEMENT_R = /^ *<([A-Za-z][^ >/]*) ?([^>]*)\/{0}>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1)[\s\S])*?)<\/\1>(?!\S)\n*/;

//const HTML_MIXED_ELEMENT_R = /^ *<([A-Za-z][^ >/]*) ?([^>]*)\/{0}>[^\n]*<\/\1>[^<\n]+\n+/;
// const HTML_MIXED_ELEMENT_R = /^([^\n<]+<[^>\n]+>|<[^>\n]+>[^\n]+<\/[^>\n]*>[^<\n]+)[^\n]+\n+/;
// const HTML_MIXED_ELEMENT_R = /^([^\n< ][^\n<]+<[^>\n]+>[^\n]+|<[^>\n]+>[^\n]+<\/[^>\n]*>[^<\n]+)(\n\n+|$)/;
var HTML_MIXED_ELEMENT_R = /^ *(([^<*#>](?!\n\n))+<[^>\n]+>[\s\S]*?|(.|\n(?!\n))+?<\/[^>\n]*>[^\n][\s\S]+?)(\n\n+|$)/;

var HTML_INLINE_ELEMENT_R = /^ *<([A-Za-z][^ >/]*) ?([^>]*)\/{0}>\n?(\s*(?:<\1[^>]*?>[\s\S]*?<\/\1>|(?!<\1)[\s\S])*?)<\/\1>/;

var HTML_COMMENT_R = /^<!--.*?-->/;

/**
 * borrowed from React 15(https://github.com/facebook/react/blob/894d20744cba99383ffd847dbd5b6e0800355a5c/src/renderers/dom/shared/HTMLDOMPropertyConfig.js)
 */
var HTML_CUSTOM_ATTR_R = /^(data|aria|x)-[a-z_][a-z\d_.-]*$/;

var HTML_SELF_CLOSING_ELEMENT_R = /^ *<([A-Za-z][\w:]*)(?:\s+((?:<.*?>|[^>])*))?>(?!<\/\1>)\s*/;
var INTERPOLATION_R = /^\{.*\}$/;
var LINK_AUTOLINK_BARE_URL_R = /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/;
var LINK_AUTOLINK_MAILTO_R = /^<([^ >]+@[^ >]+)>/;
var LINK_AUTOLINK_R = /^<([^ >]+:\/[^ >]+)>/;
var LIST_ITEM_END_R = / *\n+$/;
var LIST_LOOKBEHIND_R = /(?:^|\n)( *)$/;
var CAPTURE_LETTER_AFTER_HYPHEN = /-([a-z])?/gi;
var NP_TABLE_R = /^(.*\|?.*)\n *(\|? *[-:]+ *\|[-| :]*)\n((?:.*\|.*\n)*)\n?/;
var PARAGRAPH_R = /^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/;
var REFERENCE_IMAGE_OR_LINK = /^\[([^\]]*)\]:\s*(\S+)\s*("([^"]*)")?/;
var REFERENCE_IMAGE_R = /^!\[([^\]]*)\] ?\[([^\]]*)\]/;
var REFERENCE_LINK_R = /^\[([^\]]*)\] ?\[([^\]]*)\]/;
var SHOULD_RENDER_AS_BLOCK_R = /(\n|^[-*]\s|^#|^ {2,}|^-{2,}|^>\s)/;
var TAB_R = /\t/g;
var TABLE_TRIM_PIPES = /(^ *\||\| *$)/g;
var TABLE_CENTER_ALIGN = /^ *:-+: *$/;
var TABLE_LEFT_ALIGN = /^ *:-+ *$/;
var TABLE_RIGHT_ALIGN = /^ *-+: *$/;
var TABLE_ROW_SPLIT = / *\| */;

/**
 * (delimiter regex)((?:.*?([`~]).*?\3.*?)*|(?:.*?[\[(<].*?[\])>].*?)*|.+?)
 *
 * detects other inline syntaxes and ignores them; this helps alleviate issues like
 * **Foo `**` baz**
 *
 * Where the ** inside the backticks would be detected as the end of the bolding.
 */

/**
 * Bolding requires the same character to be used twice, so we do a detect for which
 * one is in use, then double-check it's used a second time and then twice at the end.
 *
 * Bits of the mega regex:
 *
 * |[^`~()\[\]<>]*?             ignore normal stuff
 * |(?:.*?([`~]).*?\3.*?)*      ignore stuff in backticks & tildes
 * |(?:.*?\([^)]*?\).*?)*       ignore stuff in parens
 * |(?:.*?\[[^\]]*?\].*?)*      ignore stuff in square brackets
 * |(?:.*?<.*?>.*?)*            ignore stuff in angle brackets
 *
 */
var TEXT_BOLD_R = /^([*_])\1((?:[^`~()\[\]<>]*?|(?:.*?([`~]).*?\3.*?)*|(?:.*?\([^)]*?\).*?)*|(?:.*?\[[^\]]*?\].*?)*|(?:.*?<.*?>.*?)*|[^\1]*?)\1?)\1{2}/;
var TEXT_EMPHASIZED_R = /^([*_])((?:[^`~()\[\]<>]*?|(?:.*?([`~]).*?\3.*?)*|(?:.*?\([^)]*?\).*?)*|(?:.*?\[[^\]]*?\].*?)*|(?:.*?<.*?>.*?)*|[^\1]*?))\1/;
// const TEXT_STRIKETHROUGHED_R = /^~~((?:.*?([`~]).*?\2.*?)*|(?:.*?<.*?>.*?)*|.+?)~~/;
//const TEXT_UNDERLINED_R = /^===((?:.*?([`=]).*?\2.*?)*|(?:.*?<.*?>.*?)*|.+?)===/;
var TEXT_STRIKETHROUGHED_R = /^~~([\s\S]+?)~~/; // experimenting with simplified versions of the above
var TEXT_UNDERLINED_R = /^===([\s\S]+?)===/; // because the above was not closing tags properly

var TEXT_ESCAPED_R = /^\\([^0-9A-Za-z\s])/;
var TEXT_PLAIN_R = /^[\s\S]+?(?=[^0-9A-Z\s\u00c0-\uffff]|\d+\.|\n\n| {2,}\n|\w+:\S|$)/i;
var TRIM_NEWLINES_AND_TRAILING_WHITESPACE_R = /(^\n+|(\n|\s)+$)/g;

var HTML_LEFT_TRIM_AMOUNT_R = /^([ \t]*)/;

var UNESCAPE_URL_R = /\\([^0-9A-Z\s])/gi;

// recognize a `*` `-`, `+`, `1.`, `2.`... list bullet
var LIST_BULLET = '(?:[*+-]|\\d+\\.)';

// recognize the start of a list item:
// leading space plus a bullet plus a space (`   * `)
var LIST_ITEM_PREFIX = '( *)(' + LIST_BULLET + ') +';
var LIST_ITEM_PREFIX_R = new RegExp('^' + LIST_ITEM_PREFIX);

// recognize an individual list item:
//  * hi
//    this is part of the same item
//
//    as is this, which is a new paragraph in the same item
//
//  * but this is not part of the same item
var LIST_ITEM_R = new RegExp(LIST_ITEM_PREFIX + '[^\\n]*(?:\\n' + '(?!\\1' + LIST_BULLET + ' )[^\\n]*)*(\\n|$)', 'gm');

// check whether a list item has paragraphs: if it does,
// we leave the newlines at the end
var LIST_R = new RegExp('^( *)(' + LIST_BULLET + ') ' + '[\\s\\S]+?(?:\\n{2,}(?! )' + '(?!\\1' + LIST_BULLET + ' )\\n*' +
// the \\s*$ here is so that we can parse the inside of nested
// lists, where our content might end before we receive two `\n`s
'|\\s*\\n*$)');

var LINK_INSIDE = '(?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*';
var LINK_HREF_AND_TITLE = '\\s*<?((?:[^\\s\\\\]|\\\\.)*?)>?(?:\\s+[\'"]([\\s\\S]*?)[\'"])?\\s*';

var LINK_R = new RegExp('^\\[(' + LINK_INSIDE + ')\\]\\(' + LINK_HREF_AND_TITLE + '\\)');

var IMAGE_R = new RegExp('^!\\[(' + LINK_INSIDE + ')\\]\\(' + LINK_HREF_AND_TITLE + '\\)');

var BLOCK_SYNTAXES = [BLOCKQUOTE_R, CODE_BLOCK_R, CODE_BLOCK_FENCED_R, HEADING_R, HEADING_SETEXT_R, HTML_BLOCK_ELEMENT_R, HTML_COMMENT_R, HTML_SELF_CLOSING_ELEMENT_R, LIST_ITEM_R, LIST_R, NP_TABLE_R, PARAGRAPH_R];

function containsBlockSyntax(input) {
    return BLOCK_SYNTAXES.some(function (r) {
        return r.test(input);
    });
}

// based on https://stackoverflow.com/a/18123682/1141611
// not complete, but probably good enough
function slugify(str) {
    return str.replace(/[ÀÁÂÃÄÅàáâãäåæÆ]/g, 'a').replace(/[çÇ]/g, 'c').replace(/[ðÐ]/g, 'd').replace(/[ÈÉÊËéèêë]/g, 'e').replace(/[ÏïÎîÍíÌì]/g, 'i').replace(/[Ññ]/g, 'n').replace(/[øØœŒÕõÔôÓóÒò]/g, 'o').replace(/[ÜüÛûÚúÙù]/g, 'u').replace(/[ŸÿÝý]/g, 'y').replace(/[^a-z0-9- ]/gi, '').replace(/ /gi, '-').toLowerCase();
}

function parseTableAlignCapture(alignCapture) {
    if (TABLE_RIGHT_ALIGN.test(alignCapture)) {
        return 'right';
    } else if (TABLE_CENTER_ALIGN.test(alignCapture)) {
        return 'center';
    } else if (TABLE_LEFT_ALIGN.test(alignCapture)) {
        return 'left';
    }

    return null;
}

function parseTableHeader(capture, parse, state) {
    var headerText = capture[1].replace(TABLE_TRIM_PIPES, '').trim().split(TABLE_ROW_SPLIT);

    return headerText.map(function (text) {
        return parse(text, state);
    });
}

function parseTableAlign(capture /*, parse, state*/) {
    var alignText = capture[2].replace(TABLE_TRIM_PIPES, '').trim().split(TABLE_ROW_SPLIT);

    return alignText.map(parseTableAlignCapture);
}

function parseTableCells(capture, parse, state) {
    var rowsText = capture[3].replace(TABLE_TRIM_PIPES, '').trim().split('\n');

    return rowsText.map(function (rowText) {
        return rowText.replace(TABLE_TRIM_PIPES, '').split(TABLE_ROW_SPLIT).map(function (text) {
            return parse(text.trim(), state);
        });
    });
}

function parseTable(capture, parse, state) {
    state.inline = true;
    var header = parseTableHeader(capture, parse, state);
    var align = parseTableAlign(capture, parse, state);
    var cells = parseTableCells(capture, parse, state);
    state.inline = false;

    return {
        align: align,
        cells: cells,
        header: header,
        type: 'table'
    };
}

function getTableStyle(node, colIndex) {
    return node.align[colIndex] == null ? {} : {
        textAlign: node.align[colIndex]
    };
}

/** TODO: remove for react 16 */
function normalizeAttributeKey(key) {
    var hyphenIndex = key.indexOf('-');

    if (hyphenIndex !== -1 && key.match(HTML_CUSTOM_ATTR_R) === null) {
        key = key.replace(CAPTURE_LETTER_AFTER_HYPHEN, function (_, letter) {
            return letter.toUpperCase();
        });
    }

    return key;
}

function isInterpolation(value) {
    return INTERPOLATION_R.test(value);
}

function attributeValueToJSXPropValue(key, value) {
    if (key === 'style') {
        return value.split(/;\s?/).reduce(function (styles, kvPair) {
            var key = kvPair.slice(0, kvPair.indexOf(':'));

            // snake-case to camelCase
            // also handles PascalCasing vendor prefixes
            var camelCasedKey = key.replace(/(-[a-z])/g, function toUpper(substr) {
                return substr[1].toUpperCase();
            });

            // key.length + 1 to skip over the colon
            styles[camelCasedKey] = kvPair.slice(key.length + 1).trim();

            return styles;
        }, {});
    } else if (isInterpolation(value)) {
        // return as a string and let the consumer decide what to do with it
        value = value.slice(1, value.length - 1);
    }

    if (value === 'true') {
        return true;
    } else if (value === 'false') {
        return false;
    }

    return value;
}

function normalizeWhitespace(source) {
    return source.replace(CR_NEWLINE_R, '\n').replace(FORMFEED_R, '').replace(TAB_R, '    ');
}

/**
 * Creates a parser for a given set of rules, with the precedence
 * specified as a list of rules.
 *
 * @rules: an object containing
 * rule type -> {match, order, parse} objects
 * (lower order is higher precedence)
 * (Note: `order` is added to defaultRules after creation so that
 *  the `order` of defaultRules in the source matches the `order`
 *  of defaultRules in terms of `order` fields.)
 *
 * @returns The resulting parse function, with the following parameters:
 *   @source: the input source string to be parsed
 *   @state: an optional object to be threaded through parse
 *     calls. Allows clients to add stateful operations to
 *     parsing, such as keeping track of how many levels deep
 *     some nesting is. For an example use-case, see passage-ref
 *     parsing in src/widgets/passage/passage-markdown.jsx
 */
function parserFor(rules) {
    // Sorts rules in order of increasing order, then
    // ascending rule name in case of ties.
    var ruleList = Object.keys(rules);

    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'production') {
        ruleList.forEach(function (type) {
            var order = rules[type].order;
            if (process.env.NODE_ENV !== 'production' && (typeof order !== 'number' || !isFinite(order)) && typeof console !== 'undefined') {
                console.warn('markdown-to-jsx: Invalid order for rule `' + type + '`: ' + order);
            }
        });
    }

    ruleList.sort(function (typeA, typeB) {
        var orderA = rules[typeA].order;
        var orderB = rules[typeB].order;

        // First sort based on increasing order
        if (orderA !== orderB) {
            return orderA - orderB;

            // Then based on increasing unicode lexicographic ordering
        } else if (typeA < typeB) {
            return -1;
        }

        return 1;
    });

    function nestedParse(source, state) {
        var result = [];

        // We store the previous capture so that match functions can
        // use some limited amount of lookbehind. Lists use this to
        // ensure they don't match arbitrary '- ' or '* ' in inline
        // text (see the list rule for more information).
        var prevCapture = '';
        while (source) {
            var i = 0;
            // JESSE DEBUG console.log(source);
            while (i < ruleList.length) {
                var ruleType = ruleList[i];
                var rule = rules[ruleType];
                //console.log(`checking ${ruleType} on ${source}`);
                var capture = rule.match(source, state, prevCapture);

                if (capture) {
                    var currCaptureString = capture[0];
                    source = source.substring(currCaptureString.length);
                    var parsed = rule.parse(capture, nestedParse, state);

                    // We also let rules override the default type of
                    // their parsed node if they would like to, so that
                    // there can be a single output function for all links,
                    // even if there are several rules to parse them.
                    if (parsed.type == null) {
                        parsed.type = ruleType;
                    }

                    result.push(parsed);

                    prevCapture = currCaptureString;
                    break;
                }

                i++;
            }
        }

        return result;
    }

    return function outerParse(source, state) {
        return nestedParse(normalizeWhitespace(source), state);
    };
}

// Creates a match function for an inline scoped or simple element from a regex
function inlineRegex(regex) {
    return function match(source, state) {
        if (state.inline) {
            return regex.exec(source);
        } else {
            return null;
        }
    };
}

// basically any inline element except links
function simpleInlineRegex(regex) {
    return function match(source, state) {
        if (state.inline || state.simple) {
            return regex.exec(source);
        } else {
            return null;
        }
    };
}

// Creates a match function for a block scoped element from a regex
function blockRegex(regex) {
    return function match(source, state) {
        if (state.inline || state.simple) {
            return null;
        } else {
            return regex.exec(source);
        }
    };
}

// Creates a match function from a regex, ignoring block/inline scope
function anyScopeRegex(regex) {
    return function match(source /*, state*/) {
        return regex.exec(source);
    };
}

function reactFor(outputFunc) {
    return function nestedReactOutput(ast, state) {
        state = state || {};
        if (Array.isArray(ast)) {
            var oldKey = state.key;
            var result = [];

            // map nestedOutput over the ast, except group any text
            // nodes together into a single string output.
            var lastWasString = false;

            for (var i = 0; i < ast.length; i++) {
                state.key = i;

                var nodeOut = nestedReactOutput(ast[i], state);
                var isString = typeof nodeOut === 'string';

                if (isString && lastWasString) {
                    result[result.length - 1] += nodeOut;
                } else {
                    result.push(nodeOut);
                }

                lastWasString = isString;
            }

            state.key = oldKey;

            return result;
        }

        return outputFunc(ast, nestedReactOutput, state);
    };
}

function sanitizeUrl(url) {
    try {
        var prot = decodeURIComponent(url).replace(/[^A-Z0-9/:]/gi, '').toLowerCase();

        if (prot.indexOf('javascript:') === 0) {
            return null;
        }
    } catch (e) {
        // decodeURIComponent sometimes throws a URIError
        // See `decodeURIComponent('a%AFc');`
        // http://stackoverflow.com/questions/9064536/javascript-decodeuricomponent-malformed-uri-exception
        return null;
    }

    return url;
}

function unescapeUrl(rawUrlString) {
    return rawUrlString.replace(UNESCAPE_URL_R, '$1');
}

/**
 * Everything inline, including links.
 */
function parseInline(parse, content, state) {
    var isCurrentlyInline = state.inline || false;
    var isCurrentlySimple = state.simple || false;
    state.inline = true;
    state.simple = true;
    var result = parse(content, state);
    state.inline = isCurrentlyInline;
    state.simple = isCurrentlySimple;
    return result;
}

/**
 * Anything inline that isn't a link.
 */
function parseSimpleInline(parse, content, state) {
    var isCurrentlyInline = state.inline || false;
    var isCurrentlySimple = state.simple || false;
    state.inline = false;
    state.simple = true;
    var result = parse(content, state);
    state.inline = isCurrentlyInline;
    state.simple = isCurrentlySimple;
    return result;
}

function parseBlock(parse, content, state) {
    state.inline = false;
    return parse(content + '\n\n', state);
}

function parseCaptureInline(capture, parse, state) {
    return {
        content: parseInline(parse, capture[1], state)
    };
}

function captureNothing() {
    return {};
}
function renderNothing() {
    return null;
}

function ruleOutput(rules) {
    return function nestedRuleOutput(ast, outputFunc, state) {
        return rules[ast.type].react(ast, outputFunc, state);
    };
}

function cx() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
}

function get(src, path, fb) {
    var ptr = src;
    var frags = path.split('.');

    while (frags.length) {
        ptr = ptr[frags[0]];

        if (ptr === undefined) break;else frags.shift();
    }

    return ptr || fb;
}

function getTag(tag, overrides) {
    var override = get(overrides, tag);
    return typeof override === 'function' ? override : get(overrides, tag + '.component', tag);
}

/**
 * anything that must scan the tree before everything else
 */
var PARSE_PRIORITY_MAX = 1;

/**
 * scans for block-level constructs
 */
var PARSE_PRIORITY_HIGH = 2;

/**
 * inline w/ more priority than other inline
 */
var PARSE_PRIORITY_MED = 3;

/**
 * inline elements
 */
var PARSE_PRIORITY_LOW = 4;

/**
 * bare text and stuff that is considered leftovers
 */
var PARSE_PRIORITY_MIN = 5;

function compiler(markdown, options) {
    options = options || {};
    options.overrides = options.overrides || {};
    options.slugify = options.slugify || slugify;

    var createElementFn = options.createElement || _react2.default.createElement;

    // eslint-disable-next-line no-unused-vars
    function h(tag, props) {
        var overrideProps = get(options.overrides, tag + '.props', {});

        for (var _len = arguments.length, children = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
            children[_key - 2] = arguments[_key];
        }

        return createElementFn.apply(undefined, [getTag(tag, options.overrides), _extends({}, overrideProps, props, {
            className: cx(props && props.className, overrideProps.className) || undefined
        })].concat(children));
    }

    function trimNewlinesAndTrailingWhitespace(input) {
        if (options.doNotTrimNewlinesAndTrailingWhitespace) {
            return input;
        }

        return input.replace(TRIM_NEWLINES_AND_TRAILING_WHITESPACE_R, '') + '\n\n';
    }

    function compile(input) {
        var inline = false;

        if (options.forceInline) {
            inline = true;
        } else if (!options.forceBlock) {
            /**
             * should not contain any block-level markdown like newlines, lists, headings,
             * thematic breaks, blockquotes, tables, etc
             */
            inline = SHOULD_RENDER_AS_BLOCK_R.test(input) === false;
        }

        var arr = emitter(parser(inline ? input : trimNewlinesAndTrailingWhitespace(input), { inline: inline }));

        var jsx = void 0;
        if (arr.length > 1) {
            jsx = inline ? h(
                'span',
                null,
                arr
            ) : h(
                'div',
                null,
                arr
            );
        } else if (arr.length === 1) {
            jsx = arr[0];

            // TODO: remove this for React 16
            if (typeof jsx === 'string') {
                jsx = h(
                    'span',
                    null,
                    jsx
                );
            }
        } else {
            // TODO: return null for React 16
            jsx = h('span', null);
        }

        return jsx;
    }

    function attrStringToMap(str) {
        var attributes = str.match(ATTR_EXTRACTOR_R);

        return attributes ? attributes.reduce(function (map, raw, index) {
            var delimiterIdx = raw.indexOf('=');

            if (delimiterIdx !== -1) {
                var key = normalizeAttributeKey(raw.slice(0, delimiterIdx)).trim();
                var value = (0, _unquote2.default)(raw.slice(delimiterIdx + 1).trim());

                var mappedKey = ATTRIBUTE_TO_JSX_PROP_MAP[key] || key;
                var normalizedValue = map[mappedKey] = attributeValueToJSXPropValue(key, value);

                if (HTML_BLOCK_ELEMENT_R.test(normalizedValue) || HTML_SELF_CLOSING_ELEMENT_R.test(normalizedValue)) {
                    map[mappedKey] = _react2.default.cloneElement(compile(normalizedValue.trim()), { key: index });
                }
            } else {
                map[ATTRIBUTE_TO_JSX_PROP_MAP[raw] || raw] = true;
            }

            return map;
        }, {}) : undefined;
    }

    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'production') {
        if (typeof markdown !== 'string') {
            throw new Error('markdown-to-jsx: the first argument must be\n                             a string');
        }

        if (Object.prototype.toString.call(options.overrides) !== '[object Object]') {
            throw new Error('markdown-to-jsx: options.overrides (second argument property) must be\n                             undefined or an object literal with shape:\n                             {\n                                htmltagname: {\n                                    component: string|ReactComponent(optional),\n                                    props: object(optional)\n                                }\n                             }');
        }
    }

    var footnotes = [];
    var refs = {};

    /**
     * each rule's react() output function goes through our custom h() JSX pragma;
     * this allows the override functionality to be automatically applied
     */
    var rules = {
        blockQuote: {
            match: blockRegex(BLOCKQUOTE_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse, state) {
                return {
                    content: _parse(capture[0].replace(BLOCKQUOTE_TRIM_LEFT_MULTILINE_R, ''), state)
                };
            },
            react: function react(node, output, state) {
                return h(
                    'blockquote',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        breakLine: {
            match: anyScopeRegex(BREAK_LINE_R),
            order: PARSE_PRIORITY_HIGH,
            parse: captureNothing,
            react: function react(_, __, state) {
                return h('br', { key: state.key });
            }
        },

        breakThematic: {
            match: blockRegex(BREAK_THEMATIC_R),
            order: PARSE_PRIORITY_HIGH,
            parse: captureNothing,
            react: function react(_, __, state) {
                return h('hr', { key: state.key });
            }
        },

        codeBlock: {
            match: blockRegex(CODE_BLOCK_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                var content = capture[0].replace(/^ {4}/gm, '').replace(/\n+$/, '');
                return {
                    content: content,
                    lang: undefined
                };
            },
            react: function react(node, output, state) {
                return h(
                    'pre',
                    { key: state.key },
                    h(
                        'code',
                        { className: node.lang ? 'lang-' + node.lang : '' },
                        node.content
                    )
                );
            }
        },

        codeFenced: {
            match: blockRegex(CODE_BLOCK_FENCED_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: capture[3],
                    lang: capture[2] || undefined,
                    type: 'codeBlock'
                };
            }
        },

        codeInline: {
            match: simpleInlineRegex(CODE_INLINE_R),
            order: PARSE_PRIORITY_LOW,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: capture[2]
                };
            },
            react: function react(node, output, state) {
                return h(
                    'code',
                    { key: state.key },
                    node.content
                );
            }
        },

        /**
         * footnotes are emitted at the end of compilation in a special <footer> block
         */
        footnote: {
            match: blockRegex(FOOTNOTE_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                footnotes.push({
                    footnote: capture[2],
                    identifier: capture[1]
                });

                return {};
            },

            react: renderNothing
        },

        footnoteReference: {
            match: inlineRegex(FOOTNOTE_REFERENCE_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture /*, parse*/) {
                return {
                    content: capture[1],
                    target: '#' + capture[1]
                };
            },
            react: function react(node, output, state) {
                return h(
                    'a',
                    { key: state.key, href: sanitizeUrl(node.target) },
                    h(
                        'sup',
                        { key: state.key },
                        node.content
                    )
                );
            }
        },

        gfmTask: {
            match: inlineRegex(GFM_TASK_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    completed: capture[1].toLowerCase() === 'x'
                };
            },
            react: function react(node, output, state) {
                return h('input', {
                    checked: node.completed,
                    key: state.key,
                    readOnly: true,
                    type: 'checkbox'
                });
            }
        },

        heading: {
            match: blockRegex(HEADING_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse2, state) {
                return {
                    content: parseInline(_parse2, capture[2], state),
                    id: options.slugify(capture[2]),
                    level: capture[1].length
                };
            },
            react: function react(node, output, state) {
                var Tag = 'h' + node.level;
                return h(
                    Tag,
                    { id: node.id, key: state.key },
                    output(node.content, state)
                );
            }
        },

        headingSetext: {
            match: blockRegex(HEADING_SETEXT_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture, _parse3, state) {
                return {
                    content: parseInline(_parse3, capture[1], state),
                    level: capture[2] === '=' ? 1 : 2,
                    type: 'heading'
                };
            }
        },

        // Added "A" to get rule to apply before htmlBlock (alphabetical)
        htmlAMixedInline: {
            match: function match(source, state, prevCapture) {
                var matchStatus = HTML_MIXED_ELEMENT_R.test(source) ? 'MATCHED' : 'nope';
                // console.log(`TESTING htmlMixed: ${matchStatus} on source:`, source);
                // console.log('htmlMixed: are we inline?', (state.inline));
                return state.inline ? false : HTML_MIXED_ELEMENT_R.exec(source);
            },
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse4, state) {
                // console.log('MATCHED htmlMixedInline', capture);
                // console.log('htmlMixedInline state', state);
                var inside = ('' + capture[0]).trim();
                // console.log('OUTPUT inside content:', inside);

                return {
                    /**
                    * if another html block is detected within, parse as block,
                    * otherwise parse as inline to pick up any further markdown
                    */
                    content: parseInline(_parse4, inside, state, capture[0])

                };
            },

            //
            react: function react(node, output, state) {
                return h(
                    'p',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        htmlInline: {
            match: function match(source, state) {
                // console.log(`testing htmlInline, inline is ${state.inline}, source`, source);
                return state.inline && HTML_INLINE_ELEMENT_R.exec(source);
            },
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse5, state) {
                // console.log('MATCHED htmlInline, capture', capture);
                return {
                    attrs: attrStringToMap(capture[2]),
                    content: parseInline(_parse5, capture[3], state),
                    tag: capture[1]
                };
            },
            react: function react(node, output, state) {
                return h(
                    node.tag,
                    _extends({ key: state.key }, node.attrs),
                    output(node.content, state)
                );
            }
        },

        htmlBlock: {
            /**
             * find the first matching end tag and process the interior
             */
            //match: anyScopeRegex(HTML_BLOCK_ELEMENT_R),
            match: function match(source /*, state*/) {
                // console.log('TESTING htmlBlock, source', source);
                return HTML_BLOCK_ELEMENT_R.exec(source);
            },
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse6, state) {
                // console.log('MATCHED htmlBlock, capture', capture);
                var _capture$3$match = capture[3].match(HTML_LEFT_TRIM_AMOUNT_R),
                    whitespace = _capture$3$match[1];

                var trimmer = new RegExp('^' + whitespace, 'gm');
                var trimmed = options.doNotLeftTrimInHTML ? capture[3] : capture[3].replace(trimmer, '');

                var parseFunc = containsBlockSyntax(trimmed) ? parseBlock : parseInline;

                var noInnerParse = DO_NOT_PROCESS_HTML_ELEMENTS.indexOf(capture[1]) !== -1;

                return {
                    attrs: attrStringToMap(capture[2]),
                    /**
                     * if another html block is detected within, parse as block,
                     * otherwise parse as inline to pick up any further markdown
                     */
                    content: noInnerParse ? capture[3] : parseFunc(_parse6, trimmed, state),

                    noInnerParse: noInnerParse,

                    tag: capture[1]
                };
            },
            react: function react(node, output, state) {
                return h(
                    node.tag,
                    _extends({ key: state.key }, node.attrs),
                    node.noInnerParse ? node.content : output(node.content, state)
                );
            }
        },

        htmlComment: {
            match: anyScopeRegex(HTML_COMMENT_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse() {
                return {};
            },

            react: renderNothing
        },

        htmlSelfClosing: {
            /**
             * find the first matching end tag and process the interior
             */
            match: anyScopeRegex(HTML_SELF_CLOSING_ELEMENT_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    attrs: attrStringToMap(capture[2] || ''),
                    tag: capture[1]
                };
            },
            react: function react(node, output, state) {
                return h(node.tag, _extends({}, node.attrs, { key: state.key }));
            }
        },

        image: {
            match: simpleInlineRegex(IMAGE_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    alt: capture[1],
                    target: unescapeUrl(capture[2]),
                    title: capture[3]
                };
            },
            react: function react(node, output, state) {
                return h('img', {
                    key: state.key,
                    alt: node.alt || undefined,
                    title: node.title || undefined,
                    src: sanitizeUrl(node.target)
                });
            }
        },

        link: {
            match: inlineRegex(LINK_R, false),
            order: PARSE_PRIORITY_LOW,
            parse: function parse(capture, _parse7, state) {
                return {
                    content: parseSimpleInline(_parse7, capture[1], state),
                    target: unescapeUrl(capture[2]),
                    title: capture[3]
                };
            },
            react: function react(node, output, state) {
                return h(
                    'a',
                    {
                        key: state.key,
                        href: sanitizeUrl(node.target),
                        title: node.title
                    },
                    output(node.content, state)
                );
            }
        },

        // https://daringfireball.net/projects/markdown/syntax#autolink
        linkAngleBraceStyleDetector: {
            match: inlineRegex(LINK_AUTOLINK_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: [{
                        content: capture[1],
                        type: 'text'
                    }],
                    target: capture[1],
                    type: 'link'
                };
            }
        },

        linkBareUrlDetector: {
            match: inlineRegex(LINK_AUTOLINK_BARE_URL_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: [{
                        content: capture[1],
                        type: 'text'
                    }],
                    target: capture[1],
                    title: undefined,
                    type: 'link'
                };
            }
        },

        linkMailtoDetector: {
            match: inlineRegex(LINK_AUTOLINK_MAILTO_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse, state*/) {
                var address = capture[1];
                var target = capture[1];

                // Check for a `mailto:` already existing in the link:
                if (!AUTOLINK_MAILTO_CHECK_R.test(target)) {
                    target = 'mailto:' + target;
                }

                return {
                    content: [{
                        content: address.replace('mailto:', ''),
                        type: 'text'
                    }],
                    target: target,
                    type: 'link'
                };
            }
        },

        list: {
            match: function match(source, state, prevCapture) {
                // We only want to break into a list if we are at the start of a
                // line. This is to avoid parsing "hi * there" with "* there"
                // becoming a part of a list.
                // You might wonder, "but that's inline, so of course it wouldn't
                // start a list?". You would be correct! Except that some of our
                // lists can be inline, because they might be inside another list,
                // in which case we can parse with inline scope, but need to allow
                // nested lists inside this inline scope.
                var isStartOfLine = LIST_LOOKBEHIND_R.exec(prevCapture);
                var isListBlock = state._list || !state.inline;

                if (isStartOfLine && isListBlock) {
                    source = isStartOfLine[1] + source;

                    return LIST_R.exec(source);
                } else {
                    return null;
                }
            },

            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture, _parse8, state) {
                var bullet = capture[2];
                var ordered = bullet.length > 1;
                var start = ordered ? +bullet : undefined;
                var items = capture[0]
                // recognize the end of a paragraph block inside a list item:
                // two or more newlines at end end of the item
                .replace(BLOCK_END_R, '\n').match(LIST_ITEM_R);

                var lastItemWasAParagraph = false;
                var itemContent = items.map(function (item, i) {
                    // We need to see how far indented the item is:
                    var space = LIST_ITEM_PREFIX_R.exec(item)[0].length;

                    // And then we construct a regex to "unindent" the subsequent
                    // lines of the items by that amount:
                    var spaceRegex = new RegExp('^ {1,' + space + '}', 'gm');

                    // Before processing the item, we need a couple things
                    var content = item
                    // remove indents on trailing lines:
                    .replace(spaceRegex, '')
                    // remove the bullet:
                    .replace(LIST_ITEM_PREFIX_R, '');

                    // Handling "loose" lists, like:
                    //
                    //  * this is wrapped in a paragraph
                    //
                    //  * as is this
                    //
                    //  * as is this
                    var isLastItem = i === items.length - 1;
                    var containsBlocks = content.indexOf('\n\n') !== -1;

                    // Any element in a list is a block if it contains multiple
                    // newlines. The last element in the list can also be a block
                    // if the previous item in the list was a block (this is
                    // because non-last items in the list can end with \n\n, but
                    // the last item can't, so we just "inherit" this property
                    // from our previous element).
                    var thisItemIsAParagraph = containsBlocks || isLastItem && lastItemWasAParagraph;
                    lastItemWasAParagraph = thisItemIsAParagraph;

                    // backup our state for restoration afterwards. We're going to
                    // want to set state._list to true, and state.inline depending
                    // on our list's looseness.
                    var oldStateInline = state.inline;
                    var oldStateList = state._list;
                    state._list = true;

                    // Parse inline if we're in a tight list, or block if we're in
                    // a loose list.
                    var adjustedContent = void 0;
                    if (thisItemIsAParagraph) {
                        state.inline = false;
                        adjustedContent = content.replace(LIST_ITEM_END_R, '\n\n');
                    } else {
                        state.inline = true;
                        adjustedContent = content.replace(LIST_ITEM_END_R, '');
                    }

                    var result = _parse8(adjustedContent, state);

                    // Restore our state before returning
                    state.inline = oldStateInline;
                    state._list = oldStateList;

                    return result;
                });

                return {
                    items: itemContent,
                    ordered: ordered,
                    start: start
                };
            },
            react: function react(node, output, state) {
                var Tag = node.ordered ? 'ol' : 'ul';

                return h(
                    Tag,
                    { key: state.key, start: node.start },
                    node.items.map(function generateListItem(item, i) {
                        return h(
                            'li',
                            { key: i },
                            output(item, state)
                        );
                    })
                );
            }
        },

        newlineCoalescer: {
            match: blockRegex(CONSECUTIVE_NEWLINE_R),
            order: PARSE_PRIORITY_LOW,
            parse: captureNothing,
            react: function react() /*node, output, state*/{
                return '\n';
            }
        },

        paragraph: {
            match: blockRegex(PARAGRAPH_R),
            order: PARSE_PRIORITY_LOW,
            parse: parseCaptureInline,
            react: function react(node, output, state) {
                return h(
                    'p',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        ref: {
            match: inlineRegex(REFERENCE_IMAGE_OR_LINK),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture /*, parse*/) {
                refs[capture[1]] = {
                    target: capture[2],
                    title: capture[4]
                };

                return {};
            },

            react: renderNothing
        },

        refImage: {
            match: simpleInlineRegex(REFERENCE_IMAGE_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture) {
                return {
                    alt: capture[1] || undefined,
                    ref: capture[2]
                };
            },
            react: function react(node, output, state) {
                return h('img', {
                    key: state.key,
                    alt: node.alt,
                    src: sanitizeUrl(refs[node.ref].target),
                    title: refs[node.ref].title
                });
            }
        },

        refLink: {
            match: inlineRegex(REFERENCE_LINK_R),
            order: PARSE_PRIORITY_MAX,
            parse: function parse(capture, _parse9, state) {
                return {
                    content: _parse9(capture[1], state),
                    ref: capture[2]
                };
            },
            react: function react(node, output, state) {
                return h(
                    'a',
                    {
                        key: state.key,
                        href: sanitizeUrl(refs[node.ref].target),
                        title: refs[node.ref].title
                    },
                    output(node.content, state)
                );
            }
        },

        table: {
            match: blockRegex(NP_TABLE_R),
            order: PARSE_PRIORITY_HIGH,
            parse: parseTable,
            react: function react(node, output, state) {
                return h(
                    'table',
                    { key: state.key },
                    h(
                        'thead',
                        null,
                        h(
                            'tr',
                            null,
                            node.header.map(function generateHeaderCell(content, i) {
                                return h(
                                    'th',
                                    {
                                        key: i,
                                        style: getTableStyle(node, i),
                                        scope: 'col'
                                    },
                                    output(content, state)
                                );
                            })
                        )
                    ),
                    h(
                        'tbody',
                        null,
                        node.cells.map(function generateTableRow(row, i) {
                            return h(
                                'tr',
                                { key: i },
                                row.map(function generateTableCell(content, c) {
                                    return h(
                                        'td',
                                        {
                                            key: c,
                                            style: getTableStyle(node, c)
                                        },
                                        output(content, state)
                                    );
                                })
                            );
                        })
                    )
                );
            }
        },

        text: {
            // Here we look for anything followed by non-symbols,
            // double newlines, or double-space-newlines
            // We break on any symbol characters so that this grammar
            // is easy to extend without needing to modify this regex
            match: anyScopeRegex(TEXT_PLAIN_R),
            order: PARSE_PRIORITY_MIN,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: capture[0]
                };
            },
            react: function react(node /*, output, state*/) {
                return node.content;
            }
        },

        textBolded: {
            match: simpleInlineRegex(TEXT_BOLD_R),
            order: PARSE_PRIORITY_MED,
            parse: function parse(capture, _parse10, state) {
                return {
                    // capture[1] -> the syntax control character
                    // capture[2] -> inner content
                    content: _parse10(capture[2], state)
                };
            },
            react: function react(node, output, state) {
                return h(
                    'strong',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        textEmphasized: {
            match: simpleInlineRegex(TEXT_EMPHASIZED_R),
            order: PARSE_PRIORITY_LOW,
            parse: function parse(capture, _parse11, state) {
                return {
                    // capture[1] -> opening * or _
                    // capture[2] -> inner content
                    content: _parse11(capture[2], state)
                };
            },
            react: function react(node, output, state) {
                return h(
                    'em',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        textEscaped: {
            // We don't allow escaping numbers, letters, or spaces here so that
            // backslashes used in plain text still get rendered. But allowing
            // escaping anything else provides a very flexible escape mechanism,
            // regardless of how this grammar is extended.
            match: simpleInlineRegex(TEXT_ESCAPED_R),
            order: PARSE_PRIORITY_HIGH,
            parse: function parse(capture /*, parse, state*/) {
                return {
                    content: capture[1],
                    type: 'text'
                };
            }
        },

        textStrikethroughed: {
            match: simpleInlineRegex(TEXT_STRIKETHROUGHED_R),
            order: PARSE_PRIORITY_LOW,
            parse: parseCaptureInline,
            react: function react(node, output, state) {
                return h(
                    'del',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        },

        textUnderlined: {
            match: simpleInlineRegex(TEXT_UNDERLINED_R),
            order: PARSE_PRIORITY_LOW,
            parse: parseCaptureInline,
            react: function react(node, output, state) {
                return h(
                    'ins',
                    { key: state.key },
                    output(node.content, state)
                );
            }
        }
    };

    // Object.keys(rules).forEach(key => {
    //     let { match, parse } = rules[key];

    //     rules[key].match = (...args) => {
    //         const start = performance.now();
    //         const result = match(...args);
    //         const delta = performance.now() - start;

    //         if (delta > 5)
    //             console.warn(
    //                 `Slow match for ${key}: ${delta.toFixed(3)}ms, input: ${
    //                     args[0]
    //                 }`
    //             );

    //         return result;
    //     };

    //     rules[key].parse = (...args) => {
    //         const start = performance.now();
    //         const result = parse(...args);
    //         const delta = performance.now() - start;

    //         if (delta > 5)
    //             console.warn(`Slow parse for ${key}: ${delta.toFixed(3)}ms`);

    //         console.log(`${key}:parse`, `${delta.toFixed(3)}ms`, args[0]);

    //         return result;
    //     };
    // });

    var parser = parserFor(rules);
    var emitter = reactFor(ruleOutput(rules));

    var jsx = compile(markdown);

    if (footnotes.length) {
        jsx.props.children.push(h(
            'footer',
            null,
            footnotes.map(function createFootnote(def) {
                return h(
                    'div',
                    { id: def.identifier, key: def.identifier },
                    def.identifier,
                    emitter(parser(def.footnote, { inline: true }))
                );
            })
        ));
    }

    return jsx;
}

/**
 * A simple HOC for easy React use. Feed the markdown content as a direct child
 * and the rest is taken care of automatically.
 *
 * @param  {String}   options.children   must be a string
 * @param  {Object}   options.options    markdown-to-jsx options (arg 2 of the compiler)
 *
 * @return {ReactElement} the compiled JSX
 */

function Markdown(_ref) {
    var children = _ref.children,
        options = _ref.options,
        props = _objectWithoutProperties(_ref, ['children', 'options']);

    return _react2.default.cloneElement(compiler(children, options), props);
}

if (process.env.NODE_ENV !== 'production') {
    var PropTypes = require('prop-types');

    Markdown.propTypes = {
        children: PropTypes.string.isRequired,
        options: PropTypes.object
    };
}

//# sourceMappingURL=index.cjs.js.map