'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Case = exports.MatchError = undefined;
exports.make_case = make_case;
exports.defmatch = defmatch;
exports.match = match;
exports.match_no_throw = match_no_throw;

var _match = require('./match');

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MatchError = exports.MatchError = (function (_Error) {
  _inherits(MatchError, _Error);

  function MatchError(arg) {
    _classCallCheck(this, MatchError);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(MatchError).call(this));

    if ((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'symbol') {
      _this.message = 'No match for: ' + arg.toString();
    } else if (Array.isArray(arg)) {
      var mappedValues = arg.map(function (x) {
        return x.toString();
      });
      _this.message = 'No match for: ' + mappedValues;
    } else {
      _this.message = 'No match for: ' + arg;
    }

    _this.stack = new Error().stack;
    _this.name = _this.constructor.name;
    return _this;
  }

  return MatchError;
})(Error);

var Case = exports.Case = function Case(pattern, fn) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  _classCallCheck(this, Case);

  this.pattern = (0, _match.buildMatch)(pattern);
  this.fn = fn;
  this.guard = guard;
};

function make_case(pattern, fn) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  return new Case(pattern, fn, guard);
}

function defmatch() {
  for (var _len = arguments.length, cases = Array(_len), _key = 0; _key < _len; _key++) {
    cases[_key] = arguments[_key];
  }

  return function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = cases[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var processedCase = _step.value;

        var result = [];
        if (processedCase.pattern(args, result) && processedCase.guard.apply(this, result)) {
          return processedCase.fn.apply(this, result);
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    throw new MatchError(args);
  };
}

function match(pattern, expr) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  var result = [];
  var processedPattern = (0, _match.buildMatch)(pattern);
  if (processedPattern(expr, result) && guard.apply(this, result)) {
    return result;
  } else {
    throw new MatchError(expr);
  }
}

function match_no_throw(pattern, expr) {
  var guard = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return true;
  } : arguments[2];

  try {
    return match(pattern, expr, guard);
  } catch (e) {
    if (e instanceof MatchError) {
      return null;
    }

    throw e;
  }
}
//# sourceMappingURL=data:application/json;base64,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QUFDOUQsV0FBTyxNQUFNLENBQUM7R0FDZixNQUFJO0FBQ0gsVUFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUM1QjtDQUNGOztBQUVNLFNBQVMsY0FBYyxDQUFDLE9BQVksRUFBRSxJQUFTLEVBQTZDO01BQTNDLEtBQWUseURBQUc7V0FBTSxJQUFJO0dBQUE7O0FBQ2xGLE1BQUc7QUFDRCxXQUFPLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQ3BDLENBQUEsT0FBTSxDQUFDLEVBQUM7QUFDUCxRQUFHLENBQUMsWUFBWSxVQUFVLEVBQUM7QUFDekIsYUFBTyxJQUFJLENBQUM7S0FDYjs7QUFFRCxVQUFNLENBQUMsQ0FBQztHQUNUO0NBQ0YiLCJmaWxlIjoidGFpbG9yZWQvZGVmbWF0Y2guanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBAZmxvdyAqL1xuXG5pbXBvcnQgeyBidWlsZE1hdGNoIH0gZnJvbSBcIi4vbWF0Y2hcIjtcblxuZXhwb3J0IGNsYXNzIE1hdGNoRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGFyZzogYW55KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmKHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnKXtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmcudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYoQXJyYXkuaXNBcnJheShhcmcpKXtcbiAgICAgIGxldCBtYXBwZWRWYWx1ZXMgPSBhcmcubWFwKCh4KSA9PiB4LnRvU3RyaW5nKCkpO1xuICAgICAgdGhpcy5tZXNzYWdlID0gJ05vIG1hdGNoIGZvcjogJyArIG1hcHBlZFZhbHVlcztcbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMubWVzc2FnZSA9ICdObyBtYXRjaCBmb3I6ICcgKyBhcmc7XG4gICAgfVxuXG4gICAgdGhpcy5zdGFjayA9IChuZXcgRXJyb3IoKSkuc3RhY2s7XG4gICAgdGhpcy5uYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIENhc2Uge1xuICBwYXR0ZXJuOiBGdW5jdGlvbjtcbiAgZm46IEZ1bmN0aW9uO1xuICBndWFyZDogRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3IocGF0dGVybjogQXJyYXk8YW55PiwgZm46IEZ1bmN0aW9uLCBndWFyZDogRnVuY3Rpb24gPSAoKSA9PiB0cnVlKXtcbiAgICB0aGlzLnBhdHRlcm4gPSBidWlsZE1hdGNoKHBhdHRlcm4pO1xuICAgIHRoaXMuZm4gPSBmbjtcbiAgICB0aGlzLmd1YXJkID0gZ3VhcmQ7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VfY2FzZShwYXR0ZXJuOiBBcnJheTxhbnk+LCBmbjogRnVuY3Rpb24sIGd1YXJkOiBGdW5jdGlvbiA9ICgpID0+IHRydWUpOiBDYXNlIHtcbiAgcmV0dXJuIG5ldyBDYXNlKHBhdHRlcm4sIGZuLCBndWFyZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZtYXRjaCguLi5jYXNlczogQXJyYXk8Q2FzZT4pOiBGdW5jdGlvbiB7XG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzOiBBcnJheTxhbnk+KTogYW55IHtcbiAgICBmb3IgKGxldCBwcm9jZXNzZWRDYXNlIG9mIGNhc2VzKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICBpZiAocHJvY2Vzc2VkQ2FzZS5wYXR0ZXJuKGFyZ3MsIHJlc3VsdCkgJiYgcHJvY2Vzc2VkQ2FzZS5ndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKSB7XG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRDYXNlLmZuLmFwcGx5KHRoaXMsIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IE1hdGNoRXJyb3IoYXJncyk7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChwYXR0ZXJuOiBhbnksIGV4cHI6IGFueSwgZ3VhcmQ6IEZ1bmN0aW9uID0gKCkgPT4gdHJ1ZSk6IEFycmF5PGFueT4ge1xuICBsZXQgcmVzdWx0ID0gW107XG4gIGxldCBwcm9jZXNzZWRQYXR0ZXJuID0gYnVpbGRNYXRjaChwYXR0ZXJuKTtcbiAgaWYgKHByb2Nlc3NlZFBhdHRlcm4oZXhwciwgcmVzdWx0KSAmJiBndWFyZC5hcHBseSh0aGlzLCByZXN1bHQpKXtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9ZWxzZXtcbiAgICB0aHJvdyBuZXcgTWF0Y2hFcnJvcihleHByKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hfbm9fdGhyb3cocGF0dGVybjogYW55LCBleHByOiBhbnksIGd1YXJkOiBGdW5jdGlvbiA9ICgpID0+IHRydWUpOiA/QXJyYXk8YW55PiB7XG4gIHRyeXtcbiAgICByZXR1cm4gbWF0Y2gocGF0dGVybiwgZXhwciwgZ3VhcmQpO1xuICB9Y2F0Y2goZSl7XG4gICAgaWYoZSBpbnN0YW5jZW9mIE1hdGNoRXJyb3Ipe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdGhyb3cgZTtcbiAgfVxufVxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
