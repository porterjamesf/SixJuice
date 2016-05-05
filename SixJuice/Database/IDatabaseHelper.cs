using SixJuice.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SixJuice.Database
{
    public interface IDatabaseHelper
    {
        Task<string> CreateGame();
        Task<Game> GetGame(string roomCode);
        Task DeleteGame(string roomCode);
        Task RemoveEmptyGame(string roomCode);
        Task AddPlayer(string roomCode, string playerName);
        Task RemovePlayer(string roomCode, string playerName);
        Task<List<PlayerViewModel>> GetPlayerList(string roomCode);
        Task<List<PlayerViewModel>> PlayerReady(string roomCode, string playerName, bool isReady);
        Task SaveGame(string roomCode, Game game);

        #region Game Play

        Task<NewTurn> SetTurn(string roomCode, int value);
        Task<NewTurn> Discard(string roomCode, string playerName, Card discard);
        Task Take(string roomCode, string playerName, List<Card> fromHand, List<Card> fromTable);
        Task PlayKing(string roomCode, string playerName, Card king);
        Task PlayQueen(string roomCode, string playerName, Card queen, List<Card> fromTable);
        Task PlayJackOfClubs(string roomCode, string playerName, string queenPlayerName, Card queen, List<Card> fromTable);
        Task PlayJackOfSpades(string roomCode, string playerName, string victimName);
        Task UseForKing(string roomCode, string playerName, string source, List<List<Card>> cards, List<Card> kings);

        #endregion

        #region Connection Management

        Task AddConnectedPlayer(string connectionId, string playerName, string roomCode, string screen);
        Task<ConnectedPlayer> GetConnectedPlayer(string connectionId);
        Task<string> GetConnectedPlayerId(string roomCode, string playerName);
        Task<List<ConnectedPlayer>> GetConnectedPlayers(string roomCode);
        Task RemoveConnectedPlayer(string connectionId);
        Task ChangePlayerName(string connectionId, string newPlayerName);
        Task ChangePlayerConnectionId(string playerName, string roomCode, string newConnectionId);
        Task ChangePlayerScreen(string playername, string roomCode, string newScreen);

        //Task<string> GetPlayerScreen(string playerName, string roomCode);

        #endregion
    }
}
