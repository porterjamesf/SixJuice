using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace SixJuice.Controllers
{
    public class StartController : Controller
    {
        // GET: Start
        public ActionResult Index(string roomCode = "", string message = "", string playerName = "")
        {
            ViewBag.InitRoomCode = roomCode;
            ViewBag.InitMessage = message;
			ViewBag.PlayerName = playerName;
            return View();
        }
    }
}