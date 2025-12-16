
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import type { Product } from '@/app/menu/[companyId]/page';

export type SelectedVariant = {
    groupName: string;
    itemName: string;
    price: number;
};

export type CartItem = {
    id: string; // Unique ID for the cart item instance (product.id + timestamp)
    product: Product;
    quantity: number;
    notes?: string;
    selectedVariants?: SelectedVariant[];
    finalPrice: number; // Price of product + variants
};

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (product: Product, quantity?: number, notes?: string, variants?: SelectedVariant[]) => void;
    removeFromCart: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, quantity: number) => void;
    updateNotes: (cartItemId: string, notes: string) => void;
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

    const addToCart = (product: Product, quantity = 1, notes = '', selectedVariants: SelectedVariant[] = []) => {
        const optionsPrice = selectedVariants.reduce((total, v) => total + v.price, 0);
        const finalPrice = product.price + optionsPrice;
        
        // For products with variants, always add as a new item.
        // For products without variants, check if it already exists.
        const canMerge = !selectedVariants || selectedVariants.length === 0;

        setCartItems(prevItems => {
            if (canMerge) {
                const existingItem = prevItems.find(item => item.product.id === product.id && (!item.selectedVariants || item.selectedVariants.length === 0));
                if (existingItem) {
                    return prevItems.map(item =>
                        item.id === existingItem.id
                            ? { ...item, quantity: item.quantity + quantity }
                            : item
                    );
                }
            }
            
            // Add as a new item
            const newCartItem: CartItem = {
                id: `${product.id}-${Date.now()}`, // Create a unique ID for this specific cart instance
                product,
                quantity,
                notes,
                selectedVariants,
                finalPrice,
            };
            return [...prevItems, newCartItem];
        });
    };

    const removeFromCart = (cartItemId: string) => {
        setCartItems(prevItems => prevItems.filter(item => item.id !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(cartItemId);
        } else {
            setCartItems(prevItems =>
                prevItems.map(item =>
                    item.id === cartItemId ? { ...item, quantity } : item
                )
            );
        }
    };
    
    const updateNotes = (cartItemId: string, notes: string) => {
        setCartItems(prevItems =>
            prevItems.map(item =>
                item.id === cartItemId ? { ...item, notes } : item
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
        cartItems.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0)
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
