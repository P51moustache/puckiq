"""
Tests for player_id injection in write_predictions and write_scores.

Validates that write functions inject player_id=0 when missing.
Uses mock to avoid actual Supabase calls.
"""

from unittest.mock import MagicMock, patch

from ml.io.supabase_client import write_predictions, write_scores


class TestWritePredictionsPlayerId:
    """Test that write_predictions injects player_id=0 when missing."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_injects_player_id_zero_when_missing(self):
        client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {"game_id": 1, "model_type": "game_winner", "model_version": "v1"},
        ]
        write_predictions(client, predictions)

        # Check the data actually passed to Supabase upsert
        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 0

        # Verify on_conflict includes player_id
        call_args = client.table.return_value.upsert.call_args
        assert "player_id" in call_args.kwargs.get("on_conflict", call_args[1].get("on_conflict", ""))

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_preserves_existing_player_id(self):
        client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {"game_id": 1, "model_type": "player_props", "model_version": "v1", "player_id": 8478402},
        ]
        write_predictions(client, predictions)

        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 8478402


class TestWriteScoresPlayerId:
    """Test that write_scores injects player_id=0 when missing."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_injects_player_id_zero_when_missing(self):
        client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        scores = [
            {"game_id": 1, "model_type": "game_winner"},
        ]
        write_scores(client, scores)

        # Check the data actually passed to Supabase upsert
        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_preserves_existing_player_id(self):
        client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        scores = [
            {"game_id": 1, "model_type": "player_props", "player_id": 8478402},
        ]
        write_scores(client, scores)

        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 8478402
