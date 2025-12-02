
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';

type Product = {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
};

export type CartItem = {
    product: Product;
    quantity: number;
    notes?: string;
};

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (product: Product, quantity?: number, notes?: string) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    updateNotes: (productId: string, notes: string) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    useEffect(() => {
        const savedCart = localStorage.getItem('shoppingCart');
        if (savedCart) {
            setCartItems(JSON.parse(savedCart));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (product: Product, quantity = 1, notes = '') => {
        setCartItems(prevItems => {
            const existingItem = prevItems.find(item => item.product.id === product.id);
            if (existingItem) {
                return prevItems.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prevItems, { product, quantity, notes }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            setCartItems(prevItems =>
                prevItems.map(item =>
                    item.product.id === productId ? { ...item, quantity } : item
                )
            );
        }
    };
    
    const updateNotes = (productId: string, notes: string) => {
        setCartItems(prevItems =>
            prevItems.map(item =>
                item.product.id === productId ? { ...item, notes } : item
            )
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const totalItems = useMemo(() => 
        cartItems.reduce((sum, item) => sum + item.quantity, 0)
    , [cartItems]);
    
    const totalPrice = useMemo(() =>
        cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
    , [cartItems]);

    const value = {
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateNotes,
        clearCart,
        totalItems,
        totalPrice,
    };

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

