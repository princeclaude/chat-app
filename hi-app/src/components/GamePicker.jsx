// src/components/GamePicker.js
import React from "react";

const GamePicker = ({ onSelect }) => {
  const games = [
    {
      id: "tic-tac-toe",
      name: "Tic Tac Toe",
    //   thumbnail: "/games/tic-tac-toe.png", // optional image preview
      url: "/games/catch-dot/index.html",
    },
  ];

  return (
    <div className="p-4 bg-white rounded shadow-md">
      <h2 className="text-lg font-bold mb-3">Pick a Game</h2>
      <div className="flex flex-col gap-3">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onSelect(game)}
            className="flex items-center gap-3 p-3 border rounded hover:bg-gray-100"
          >
            <img
              src={game.thumbnail}
              alt={game.name}
              className="w-12 h-12 object-cover rounded"
            />
            <span className="font-medium">{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GamePicker;
