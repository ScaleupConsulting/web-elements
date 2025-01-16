const platformPrices = {
    "mobile": 5000,
    "computer": 2000,
    "android": 5000,
    "windows": 5000,
    "ios": 10000,
    "apple": 10000,
};

const sourcePrices = {
    apiData: 1000,
    dynamicData: 2000,
    protectionData: 5000
};

const paymentPrice = {
    masterCard: 1000,
    paypal: 2000,
    market: 5000
}

const featurePrices = {
    Instant: 5000,
    chat: 2000,
};    
const mapPrices = {
    points: 1000,
    interactive: 5000,
    transport: 2000,
};
getPrice = () => {
    // read from local storage
    const platforms = Object.keys(platformPrices);
    let sum = 0;
    for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        if (localStorage.getItem(platform) === "true") {
            sum += platformPrices[platform];
        }
    }

    const sources = Object.keys(sourcePrices);
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const count = localStorage.getItem(source);
        if (count) {
            sum += sourcePrices[source] * Number(count);
        }

    }

    const payments = Object.keys(paymentPrice);
    for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        if (localStorage.getItem(payment) === "true") {
            sum += paymentPrice[payment];
        }
    }

    const features = Object.keys(featurePrices);
    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        if (localStorage.getItem(feature) === "true") {
            sum += featurePrices[feature];
        }
    }
    const maps = Object.keys(mapPrices);
    for (let i = 0; i < maps.length; i++) {
        const map = maps[i];
        if (localStorage.getItem(map) === "true") {
            sum += mapPrices[map];
        }
    }



    return sum;
};
showPrice = () => {
    const price = getPrice();
    document.getElementById("total").innerHTML = `$${price}`;

}


