import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
import urllib.error

spec = importlib.util.spec_from_file_location('api', Path(__file__).parents[1] / 'server/api.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.server = api.ThreadingHTTPServer(('127.0.0.1', 0), api.Handler)
        self.server.data_dir = Path(self.tmp.name)
        self.server.api_key = 'test-key'
        (self.server.data_dir / 'chats').mkdir()
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%s' % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def request(self, route, method='GET', body=None, key='test-key'):
        req = urllib.request.Request(self.url + route, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'X-API-Key': key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def chat(self):
        return {'id': 'test-123', 'title': 'Hallo', 'messages': [{'role': 'user', 'content': 'wereld'}], 'created': 1, 'updated': 2, 'project': 'delphi', 'preset': 'coder'}

    def test_roundtrip_search_metadata_delete(self):
        c = self.chat()
        self.assertEqual(self.request('/api/history', 'POST', c)[0], 200)
        self.assertEqual(self.request('/api/history/test-123')[1], c)
        self.assertEqual(self.request('/api/history/list')[1][0]['project'], 'delphi')
        self.assertEqual(self.request('/api/history/test-123', 'DELETE')[0], 200)
        self.assertEqual(self.request('/api/history/test-123')[0], 404)
        self.assertEqual(self.request('/api/history/deleted')[1], ['test-123'])
        self.assertEqual(self.request('/api/history', 'POST', c)[0], 409)

    def test_auth_validation_path_escape_conflict(self):
        self.assertEqual(self.request('/api/history/list', key='wrong')[0], 401)
        for route in ['/api/history/..%2Fsecret', '/api/history/%00', '/api/history/a/b']:
            self.assertEqual(self.request(route)[0], 400)
        c = self.chat(); c['id'] = '../bad'
        self.assertEqual(self.request('/api/history', 'POST', c)[0], 400)
        c = self.chat(); c['messages'] = [{'role': 'bad', 'content': 'x'}]
        self.assertEqual(self.request('/api/history', 'POST', c)[0], 400)
        c = self.chat(); self.request('/api/history', 'POST', c); c['updated'] = 1
        self.assertEqual(self.request('/api/history', 'POST', c)[0], 409)
        self.assertEqual(self.request('/api/history/test-123')[1]['updated'], 2)

    def test_inspection_read_and_review_head_guard(self):
        self.assertEqual(len(self.request('/api/inspections')[1]), 4)
        file = self.server.data_dir / 'watchdog/inspections/DELPHI/latest.json'
        api.atomic_json(file, {'project':'DELPHI','head':'abc','status':'pending','fixes':[]})
        self.assertEqual(self.request('/api/inspections/DELPHI')[1]['head'], 'abc')
        self.assertEqual(self.request('/api/inspections/DELPHI', 'POST', {'status':'merged','head':'wrong'})[0], 409)
        self.assertEqual(self.request('/api/inspections/DELPHI', 'POST', {'status':'ignored','head':'abc'})[0], 200)
        self.assertEqual(self.request('/api/inspections/unknown')[0], 400)


if __name__ == '__main__':
    unittest.main()
