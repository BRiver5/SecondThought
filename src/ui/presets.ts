import { router } from "expo-router";

export const CATEGORIES = ["Clothes", "Gadgets", "Home", "Beauty", "Hobby", "Books", "Food & drink", "Other"];
export const TRIGGERS = ["Ad", "Sale", "Bored", "Stressed", "Friend has it", "Saw in store", "Need-ish"];

// Частые хотелки в один тап: название, примерная цена, категория.
export const QUICK = [
  { name: "Sneakers", price: 90, category: "Clothes" },
  { name: "Headphones", price: 150, category: "Gadgets" },
  { name: "Scented candle", price: 25, category: "Home" },
  { name: "Video game", price: 60, category: "Hobby" },
  { name: "Skincare set", price: 45, category: "Beauty" },
  { name: "New book", price: 22, category: "Books" },
  { name: "Takeout treat", price: 28, category: "Food & drink" },
  { name: "Phone case", price: 30, category: "Gadgets" },
];

// Expo Go восстанавливает последний маршрут без истории — back() молча ничего не делает.
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
