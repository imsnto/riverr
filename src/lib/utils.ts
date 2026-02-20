
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const whimsicalAdjectives = ["Clever", "Silly", "Witty", "Happy", "Brave", "Curious", "Dapper", "Eager", "Fancy", "Gentle", "Jolly", "Kindly", "Lucky", "Merry", "Nifty", "Plucky", "Quirky", "Sunny", "Thrifty", "Zippy", "Agile", "Blissful", "Calm", "Dandy", "Elated", "Fearless"];
export const whimsicalNouns = ["Alpaca", "Badger", "Capybara", "Dingo", "Echidna", "Fossa", "Gecko", "Hedgehog", "Impala", "Jerboa", "Koala", "Loris", "Mongoose", "Narwhal", "Okapi", "Pangolin", "Quokka", "Serval", "Tarsier", "Urial", "Wallaby", "Xerus", "Zebra", "Aardvark"];

export function getInitials(name: string | null | undefined): string {
    if (!name) return '';
    const words = name.trim().split(' ').filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    return '';
}

export function isWhimsical(name: string | null | undefined) {
  if (!name) return true;
  const words = name.trim().split(' ').filter(Boolean);
  return words.length === 2 && whimsicalAdjectives.includes(words[0]) && whimsicalNouns.includes(words[1]);
}

export function generateWhimsicalName() {
  return `${whimsicalAdjectives[Math.floor(Math.random() * whimsicalAdjectives.length)]} ${whimsicalNouns[Math.floor(Math.random() * whimsicalNouns.length)]}`;
}
