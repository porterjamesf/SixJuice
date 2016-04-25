$(function () {
    changeGraphic = function (target, data) {
        if (target = "deck") {
            $('#deck').empty();
            switch (data.length) {
                case 0:
                    $('#deck').append('<img src="/Content/Images/deck0.gif" style="height:95px;width:85px;"/>');
                    break;
                case 1:
                    $('#deck').append('<img src="/Content/Images/deck1back.gif" style="height:95px;width:85px;"/>');
                    break;
                case 2:
                    $('#deck').append('<img src="/Content/Images/deck2back.gif" style="height:95px;width:85px;"/>');
                    break;
                case 3:
                    $('#deck').append('<img src="/Content/Images/deck3back.gif" style="height:95px;width:85px;"/>');
                    break;
                case 4:
                    $('#deck').append('<img src="/Content/Images/deck4back.gif" style="height:95px;width:85px;"/>');
                    break;
                case 5:
                    $('#deck').append('<img src="/Content/Images/deck5back.gif" style="height:95px;width:85px;"/>');
                    break;
                default:
                    $('#deck').append('<img src="/Content/Images/deck6back.gif" style="height:95px;width:85px;"/>');
                    break;
            }
        }
        if (target = "table") {
            $('#table').empty();
        }
    }
});