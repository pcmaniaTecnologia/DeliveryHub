const admin = require('firebase-admin');

// Tenta inicializar
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Tenta usar as credenciais padrão do sistema
        projectId: 'studio-516051115-a8e0e'
    });
}

const db = admin.firestore();

async function fixOrders() {
    try {
        const companiesSnap = await db.collection('companies').get();
        let fixedCount = 0;
        let checkedCount = 0;

        for (const companyDoc of companiesSnap.docs) {
            const ordersSnap = await db.collection('companies').doc(companyDoc.id).collection('orders').get();
            
            for (const orderDoc of ordersSnap.docs) {
                checkedCount++;
                const orderData = orderDoc.data();
                
                if (!orderData.orderItems || !Array.isArray(orderData.orderItems)) continue;

                const itemsTotal = orderData.orderItems.reduce((sum, item) => {
                    const priceToUse = item.finalPrice || item.unitPrice || 0;
                    const quantity = item.quantity || 1;
                    return sum + (priceToUse * quantity);
                }, 0);

                const finalCalculatedTotal = itemsTotal + (orderData.deliveryFee || 0);

                if (Math.abs((orderData.totalAmount || 0) - finalCalculatedTotal) > 0.01) {
                    await orderDoc.ref.update({
                        totalAmount: finalCalculatedTotal
                    });
                    fixedCount++;
                    console.log(`Fixing order ${orderDoc.id}: ${orderData.totalAmount} -> ${finalCalculatedTotal}`);
                }
            }
        }
        console.log(`DONE! Checked: ${checkedCount}, Fixed: ${fixedCount}`);
    } catch (e) {
        console.error('Error:', e);
    }
}

fixOrders();
