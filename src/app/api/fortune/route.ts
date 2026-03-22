import { withPayment } from "@moneydevkit/nextjs/server";

const fortunes = [
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "A ship in harbor is safe, but that is not what ships are built for.",
  "The obstacle is the way.",
  "What you seek is seeking you. — Rumi",
  "He who has a why to live can bear almost any how. — Nietzsche",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "In the middle of difficulty lies opportunity. — Einstein",
  "Fortune favors the bold. — Virgil",
  "The cave you fear to enter holds the treasure you seek. — Joseph Campbell",
  "Not all those who wander are lost. — Tolkien",
  "The wound is the place where the light enters you. — Rumi",
  "We suffer more in imagination than in reality. — Seneca",
  "Memento mori. — Marcus Aurelius",
  "Kites rise highest against the wind, not with it. — Churchill",
  "The best revenge is massive success. — Sinatra",
  "Be yourself; everyone else is already taken. — Oscar Wilde",
  "It is not the mountain we conquer, but ourselves. — Edmund Hillary",
  "The only limit to our realization of tomorrow will be our doubts of today. — FDR",
  "Do not go gentle into that good night. — Dylan Thomas",
  "Everything you can imagine is real. — Picasso",
  "The unexamined life is not worth living. — Socrates",
  "Turn your wounds into wisdom. — Oprah",
  "Stars can't shine without darkness.",
  "A smooth sea never made a skilled sailor.",
  "The man who moves a mountain begins by carrying away small stones. — Confucius",
  "What we think, we become. — Buddha",
  "Life shrinks or expands in proportion to one's courage. — Anaïs Nin",
  "The only impossible journey is the one you never begin. — Tony Robbins",
  "If you want to go fast, go alone. If you want to go far, go together. — African proverb",
  "The diamond cannot be polished without friction. — Confucius",
  "Fall seven times, stand up eight. — Japanese proverb",
  "Where there is no struggle, there is no strength. — Oprah",
  "An uncut gem does not sparkle.",
  "You miss 100% of the shots you don't take. — Gretzky",
  "Luck is what happens when preparation meets opportunity. — Seneca",
  "The bamboo that bends is stronger than the oak that resists. — Japanese proverb",
  "No pressure, no diamonds. — Thomas Carlyle",
  "The dose makes the poison. — Paracelsus",
  "Amor fati — love your fate. — Nietzsche",
  "Be water, my friend. — Bruce Lee",
  "Action is the foundational key to all success. — Picasso",
  "The mind is everything. What you think, you become. — Buddha",
  "It always seems impossible until it's done. — Mandela",
  "He who fears he shall suffer, already suffers what he fears. — Montaigne",
  "Knowledge speaks, but wisdom listens. — Hendrix",
  "To live is the rarest thing in the world. Most people exist, that is all. — Oscar Wilde",
  "In three words I can sum up everything I've learned about life: it goes on. — Robert Frost",
  "The quieter you become, the more you can hear. — Ram Dass",
  "We are what we repeatedly do. Excellence is not an act, but a habit. — Aristotle",
  "21 million. No more, no less. — Satoshi Nakamoto",
];

const handler = async () => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  return Response.json({
    fortune,
    timestamp: new Date().toISOString(),
  });
};

export const GET = withPayment({ amount: 10, currency: "SAT" }, handler);
