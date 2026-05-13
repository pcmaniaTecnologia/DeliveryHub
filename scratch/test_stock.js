
// Using native fetch

async function testStockDecrement() {
    const url = 'http://localhost:8080/api/stock/decrement';
    const body = {
        companyId: 'studio-516051115-a8e0e', // I hope this is valid
        items: [{ productId: 'test-product', quantity: 1 }]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', data);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testStockDecrement();
