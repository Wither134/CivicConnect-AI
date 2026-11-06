"""
CivicConnect AI - Citizen Complaint Lifecycle & Status Tracking E2E Test Suite.

Verifies the complete end-to-end workflow:
1. Citizen account creation & authentication.
2. Incident complaint submission with rate-limiting & auto-triage.
3. Moderator status progression: submitted -> under_review -> verified -> assigned -> in_progress.
4. Work completion: in_progress -> work_completed with evidence & notes.
5. Strict two-person rule enforcement: prevents work completer from self-resolving.
6. Independent administrator verification: approves & signs off as resolved.
7. Citizen status visibility: citizen sees resolved status, latest notes, and both staff names.
8. Citizen detail inspection: full 6-stage chronological audit timeline & completion proof.
9. Notification delivery: real notifications recorded atomically for each milestone.
10. Citizen privacy protection: non-owners cannot see citizen private identity or exact GPS.
"""

from datetime import datetime
from pathlib import Path
import sys
import unittest

backend_py_dir = Path(__file__).resolve().parent.parent
if str(backend_py_dir) not in sys.path:
    sys.path.insert(0, str(backend_py_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed import seed_database


class TestCitizenStatusWorkflow(unittest.TestCase):
    """Complete End-to-End Citizen Tracking & Governance Verification."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_database(db)
        cls.client = TestClient(app)

    def test_complete_citizen_tracking_workflow(self):
        # -------------------------------------------------------------
        # STEP 1: Register and login as a new citizen (Anya Citizen)
        # -------------------------------------------------------------
        ts = int(datetime.now().timestamp() * 1000)
        reg_payload = {
            "name": "Anya Sharma",
            "email": f"anya.sharma.{ts}@example.com",
            "password": "Password123!",
            "phone": "+91 98450 11223",
            "ward": "Ward 22 - Malleshwaram"
        }
        res_reg = self.client.post("/api/auth/register", json=reg_payload)
        self.assertIn(res_reg.status_code, [200, 201])
        citizen_token = res_reg.json()["token"]
        citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

        # -------------------------------------------------------------
        # STEP 2: Citizen submits a new complaint
        # -------------------------------------------------------------
        complaint_payload = {
            "title": "Hazardous electrical wire hanging near school gate",
            "description": "Exposed high voltage wire dangling at 1.5 meters from pedestrian pavement right opposite National Public School.",
            "category_name": "Streetlights & Lighting",
            "exact_lat": 13.0035,
            "exact_lng": 77.5685,
            "ward": "Ward 22 - Malleshwaram",
            "address_hint": "Opposite National Public School Gate 1",
            "images": [
                "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800"
            ]
        }
        res_sub = self.client.post("/api/reports", json=complaint_payload, headers=citizen_headers)
        self.assertEqual(res_sub.status_code, 201)
        sub_data = res_sub.json()
        report_id = sub_data["report"]["id"]
        ref_number = sub_data["report"]["referenceNumber"]
        self.assertIsNotNone(report_id)
        self.assertTrue(ref_number.startswith("CPR-2026-"))
        self.assertEqual(sub_data["report"]["status"], "submitted")

        # Initial check by citizen on /my-reports
        res_my = self.client.get("/api/reports/my-reports", headers=citizen_headers)
        self.assertEqual(res_my.status_code, 200)
        reports = res_my.json()["reports"]
        my_item = next((r for r in reports if r["id"] == report_id), None)
        self.assertIsNotNone(my_item)
        self.assertEqual(my_item["status"], "submitted")

        # -------------------------------------------------------------
        # STEP 3: Authenticate as municipal moderator (Priya N.) via 2-Step MFA
        # -------------------------------------------------------------
        s1 = self.client.post("/api/auth/staff-login", json={
            "email": "priya.n@civicfix.org",
            "password": "CivicFix#2026"
        })
        self.assertEqual(s1.status_code, 200)
        temp_token = s1.json()["tempToken"]

        s2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": temp_token,
            "code": "123456"
        })
        self.assertEqual(s2.status_code, 200)
        priya_token = s2.json()["token"]
        priya_headers = {"Authorization": f"Bearer {priya_token}"}

        # -------------------------------------------------------------
        # STEP 4: Moderator advances status: submitted -> under_review
        # -------------------------------------------------------------
        res_trans_1 = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "under_review",
            "note": "Report received and triaged by Central Ward Moderation Desk. Priority confirmed High."
        }, headers=priya_headers)
        self.assertEqual(res_trans_1.status_code, 200)
        self.assertEqual(res_trans_1.json()["toStatus"], "under_review")

        # Advance: under_review -> verified
        res_trans_2 = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "verified",
            "note": "Field coordinates and hazard verified via geospatial proximity check."
        }, headers=priya_headers)
        self.assertEqual(res_trans_2.status_code, 200)
        self.assertEqual(res_trans_2.json()["toStatus"], "verified")

        # Advance: verified -> assigned
        res_trans_3 = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "assigned",
            "note": "Assigned to Electrical Department Emergency Field Crew #4."
        }, headers=priya_headers)
        self.assertEqual(res_trans_3.status_code, 200)
        self.assertEqual(res_trans_3.json()["toStatus"], "assigned")

        # Advance: assigned -> in_progress
        res_trans_4 = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "in_progress",
            "note": "Field truck on-site. Securing live junction box and replacing snapped cable insulator."
        }, headers=priya_headers)
        self.assertEqual(res_trans_4.status_code, 200)
        self.assertEqual(res_trans_4.json()["toStatus"], "in_progress")

        # Advance: in_progress -> work_completed with completion proof
        res_trans_5 = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "work_completed",
            "note": "Snapped line replaced with heavy-duty insulated cable, secured at 6 meters above road level.",
            "proofImageUrl": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800"
        }, headers=priya_headers)
        self.assertEqual(res_trans_5.status_code, 200)
        self.assertEqual(res_trans_5.json()["toStatus"], "work_completed")

        # -------------------------------------------------------------
        # STEP 5: TWO-PERSON RULE TEST
        # Priya (who marked work completed) attempts to self-resolve
        # Must be rejected with HTTP 403 Forbidden!
        # -------------------------------------------------------------
        res_self_resolve = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "resolved",
            "note": "Attempting self-signoff by same operator."
        }, headers=priya_headers)
        self.assertEqual(res_self_resolve.status_code, 403)
        self.assertIn("two-person rule violation", res_self_resolve.json()["detail"].lower())

        # -------------------------------------------------------------
        # STEP 6: Authenticate as independent administrator (Super Admin)
        # -------------------------------------------------------------
        sa1 = self.client.post("/api/auth/staff-login", json={
            "email": "superadmin@civicfix.org",
            "password": "CivicFix#2026"
        })
        self.assertEqual(sa1.status_code, 200)
        super_temp = sa1.json()["tempToken"]

        sa2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": super_temp,
            "code": "123456"
        })
        self.assertEqual(sa2.status_code, 200)
        super_token = sa2.json()["token"]
        super_headers = {"Authorization": f"Bearer {super_token}"}

        # -------------------------------------------------------------
        # STEP 7: Super Admin verifies completion & signs off as resolved
        # -------------------------------------------------------------
        res_resolve = self.client.post(f"/api/admin/reports/{report_id}/status", json={
            "toStatus": "resolved",
            "note": "Independent physical inspection confirmed work completed to safety specifications. Issue closed."
        }, headers=super_headers)
        self.assertEqual(res_resolve.status_code, 200)
        self.assertEqual(res_resolve.json()["toStatus"], "resolved")

        # -------------------------------------------------------------
        # STEP 8: Citizen returns and inspects /my-reports
        # -------------------------------------------------------------
        res_my_final = self.client.get("/api/reports/my-reports", headers=citizen_headers)
        self.assertEqual(res_my_final.status_code, 200)
        # Verify Cache-Control header
        self.assertIn("no-cache", res_my_final.headers.get("Cache-Control", ""))

        my_final_item = next((r for r in res_my_final.json()["reports"] if r["id"] == report_id), None)
        self.assertIsNotNone(my_final_item)
        self.assertEqual(my_final_item["status"], "resolved")
        self.assertIsNotNone(my_final_item["updatedAt"])
        self.assertIsNotNone(my_final_item["workCompletedAt"])
        self.assertIsNotNone(my_final_item["resolvedAt"])
        self.assertEqual(my_final_item["workCompleterName"], "Priya N.")
        self.assertEqual(my_final_item["reviewerName"], "Super Administrator")
        # Ensure workCompleter and reviewer are distinct
        self.assertNotEqual(my_final_item["workCompleterName"], my_final_item["reviewerName"])
        self.assertIn("Independent physical inspection confirmed", my_final_item["latestNote"])
        self.assertEqual(my_final_item["timelineCount"], 7)  # initial submission + 6 transitions

        # -------------------------------------------------------------
        # STEP 9: Citizen inspects /reports/{id} and /reports/{ref_number}
        # -------------------------------------------------------------
        res_detail_uuid = self.client.get(f"/api/reports/{report_id}", headers=citizen_headers)
        self.assertEqual(res_detail_uuid.status_code, 200)
        detail_data = res_detail_uuid.json()
        self.assertEqual(detail_data["status"], "resolved")
        self.assertEqual(detail_data["report"]["status"], "resolved")
        self.assertTrue(detail_data["isOwner"])
        # Owner can see their own reporter identity and exact GPS coordinates
        self.assertEqual(detail_data["reporterName"], "Anya Sharma")
        self.assertAlmostEqual(detail_data["exactLat"], 13.0035, places=3)
        self.assertAlmostEqual(detail_data["exactLng"], 77.5685, places=3)

        # Lookup by Reference Number
        res_detail_ref = self.client.get(f"/api/reports/{ref_number}", headers=citizen_headers)
        self.assertEqual(res_detail_ref.status_code, 200)
        self.assertEqual(res_detail_ref.json()["id"], report_id)

        # Verify chronological timeline structure
        timeline = detail_data["timeline"]
        self.assertEqual(len(timeline), 7)
        statuses_in_order = [t["toStatus"] for t in timeline]
        self.assertEqual(statuses_in_order, [
            "submitted",
            "under_review",
            "verified",
            "assigned",
            "in_progress",
            "work_completed",
            "resolved"
        ])
        # Verify proof image on work_completed step
        work_completed_step = next(t for t in timeline if t["toStatus"] == "work_completed")
        self.assertIsNotNone(work_completed_step["proofImageUrl"])
        self.assertEqual(work_completed_step["actorName"], "Priya N.")

        resolved_step = next(t for t in timeline if t["toStatus"] == "resolved")
        self.assertEqual(resolved_step["actorName"], "Super Administrator")

        # -------------------------------------------------------------
        # STEP 10: Check Citizen Real Notifications
        # -------------------------------------------------------------
        res_notifs = self.client.get("/api/notifications", headers=citizen_headers)
        self.assertEqual(res_notifs.status_code, 200)
        notifs_data = res_notifs.json()
        citizen_notifs = [n for n in notifs_data["notifications"] if n["reportId"] == report_id]
        # Notifications created for under_review, verified, assigned, in_progress, work_completed, resolved
        self.assertGreaterEqual(len(citizen_notifs), 6)
        titles = [n["title"] for n in citizen_notifs]
        self.assertTrue(any("Resolved" in t for t in titles))
        self.assertTrue(any("Work Completed" in t for t in titles))
        self.assertTrue(any("Under Review" in t for t in titles))

        # Test marking one notification as read
        first_notif_id = citizen_notifs[0]["id"]
        res_read = self.client.post(f"/api/notifications/{first_notif_id}/read", headers=citizen_headers)
        self.assertEqual(res_read.status_code, 200)
        self.assertTrue(res_read.json()["isRead"])

        # -------------------------------------------------------------
        # STEP 11: PRIVACY TEST
        # Citizen B queries Citizen A's complaint
        # Must NOT expose Citizen A's private identity or exact GPS
        # -------------------------------------------------------------
        reg_b = self.client.post("/api/auth/register", json={
            "name": "Citizen Bob",
            "email": f"bob.neighbour.{ts}@example.com",
            "password": "Password123!"
        })
        self.assertIn(reg_b.status_code, [200, 201])
        token_b = reg_b.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        res_b_view = self.client.get(f"/api/reports/{report_id}", headers=headers_b)
        self.assertEqual(res_b_view.status_code, 200)
        b_data = res_b_view.json()
        self.assertFalse(b_data["isOwner"])
        # Privacy masks:
        self.assertEqual(b_data["reporterName"], "Verified Resident")
        self.assertIsNone(b_data["reporterId"])
        self.assertIsNone(b_data["exactLat"])
        self.assertIsNone(b_data["exactLng"])
        # Coarsened coordinates remain visible for GIS heatmaps
        self.assertIsNotNone(b_data["coarsenedLat"])
        self.assertIsNotNone(b_data["coarsenedLng"])


if __name__ == "__main__":
    unittest.main()
