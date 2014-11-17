import Ember from 'ember';

function stripePrice(currency, amount) {
    var symbol, price;
    switch (currency) {
        case 'usd':
            symbol = "$";
            break;
        case 'gbp':
            symbol = "£";
            break;
        case 'eur':
            symbol = "€";
            break;
        default:
            symbol = "$";
            break;
    }
    price = amount / 100;
    return symbol + price;
}

export {
    stripePrice
    };

export default Ember.Handlebars.makeBoundHelper(stripePrice);
