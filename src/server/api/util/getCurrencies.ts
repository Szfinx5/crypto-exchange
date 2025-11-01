export const getCurrenciesFromMarket = (market: string): [string, string] => {
	const [sellerCurrency, buyerCurrency] = market.split("-");

	if (!sellerCurrency || !buyerCurrency) {
		throw new Error("Invalid market format: currencies cannot be empty");
	}
	return [sellerCurrency, buyerCurrency];
};
