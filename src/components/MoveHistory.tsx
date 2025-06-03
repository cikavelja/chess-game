import React from 'react';
import { ChessMove } from '../types/chess-types';
import { getPositionNotation } from '../utils/chess-utils';

interface MoveHistoryProps {
  moves: ChessMove[];
}

const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  // Group moves in pairs (white + black)
  const groupedMoves: ChessMove[][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const pair: ChessMove[] = [moves[i]];
    if (moves[i + 1]) {
      pair.push(moves[i + 1]);
    }
    groupedMoves.push(pair);
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow">
      <h3 className="font-bold mb-2">Move History</h3>
      <div className="overflow-y-auto max-h-80">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-10 text-left">#</th>
              <th className="w-16 text-left">White</th>
              <th className="w-16 text-left">Black</th>
            </tr>
          </thead>
          <tbody>
            {groupedMoves.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-gray-500 italic py-2">
                  No moves yet
                </td>
              </tr>
            ) : (
              groupedMoves.map((pair, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white bg-opacity-50' : ''}>
                  <td className="py-1">{index + 1}.</td>
                  <td className="py-1">
                    {getPositionNotation(pair[0].from.row, pair[0].from.col)}-
                    {getPositionNotation(pair[0].to.row, pair[0].to.col)}
                  </td>
                  <td className="py-1">
                    {pair[1] ? (
                      `${getPositionNotation(pair[1].from.row, pair[1].from.col)}-
                       ${getPositionNotation(pair[1].to.row, pair[1].to.col)}`
                    ) : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MoveHistory;
