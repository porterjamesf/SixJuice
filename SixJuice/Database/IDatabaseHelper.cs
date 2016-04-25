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

        Task IncreaseTurn(string roomCode);

        #endregion

        #region Connection Management

        Task AddConnectedPlayer(string connectionId, string playerName, string roomCode, string screen);
        Task<ConnectedPlayer> GetConnectedPlayer(string connectionId);
        Task RemoveConnectedPlayer(string connectionId);
        Task ChangePlayerName(string connectionId, string newPlayerName);
        Task ChangePlayerConnectionId(string playerName, string roomCode, string newConnectionId);
        Task ChangePlayerScreen(string playername, string roomCode, string newScreen);

        //Task<string> GetPlayerScreen(string playerName, string roomCode);

        #endregion
    }
}
