using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace SixJuice.Controllers
{
    public class GameController : Controller
    {
        // GET: Game
        public ActionResult Index(string roomCode, string playerName)
        {
            ViewBag.RoomCode = roomCode;
            ViewBag.PlayerName = playerName;
            return View();
        }

        // GET: Rejoin
        public ActionResult Rejoin(string roomCode)
        {
            ViewBag.RoomCode = roomCode;
            return View();
        }
    }
}