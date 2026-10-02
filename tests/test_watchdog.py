import argparse
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).parents[1] / 'server/watchdog.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WatchdogTests(unittest.TestCase):
    def test_sensitive_files_and_large_changes_are_rejected(self):
        for name, code in [('auth.js', 'const x=1;'), ('public/app.js', "fetch('/', {headers: {'X-API-Key': key}})"), ('Caddyfile', 'x'), ('node_modules/a.js', 'const x=1;'), ('public/js/app-key.js', 'const STORAGE_KEY="x";'), ('web/config.js','const key="";'), ('settings.js','const accessToken = "value";'), ('handler.js','const env = process.env;')]:
            self.assertFalse(w.eligible(Path(name), code))
        self.assertTrue(w.eligible(Path('public/map.js'), 'const x=1;'))
        self.assertFalse(w.acceptable_change('a', ''))
        self.assertFalse(w.acceptable_change('a\n' * 100, 'b\n' * 100))

    def test_real_git_fix_branch_validation_report_and_pending_scan(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); repo = root / 'source'; remote = root / 'remote.git'; data = root / 'data'
            repo.mkdir(); (data / 'repos').mkdir(parents=True)
            w.run(['git', 'init', '-b', 'main', str(repo)])
            w.run(['git', 'config', 'user.email', 'test@example.com'], cwd=repo)
            w.run(['git', 'config', 'user.name', 'Test'], cwd=repo)
            (repo / 'public').mkdir(); (repo / 'public/sw.js').write_text("const CACHE = 'delphi-pwa-v10';\n")
            (repo / 'public/valid.js').write_text('const value = ;\nconsole.log(value);\n')
            (repo / 'correct.js').write_text('const value = 1;\n')
            (repo / 'invalid.js').write_text('const value = ;\n')
            (repo / 'auth.js').write_text('const secret = 1;\n')
            w.run(['git', 'add', '.'], cwd=repo); w.run(['git', 'commit', '-m', 'base'], cwd=repo)
            base = w.run(['git', 'rev-parse', 'HEAD'], cwd=repo)
            w.run(['git', 'clone', '--bare', str(repo), str(remote)])
            args = argparse.Namespace(data=str(data), key_file='', max_files=30, max_bytes=100000, node='node', model='test', ollama_url='http://unused', dry_run=False)
            real_run = w.run
            def local_run(command, **kwargs):
                command = [str(remote) if str(c).startswith('https://github.com/brionize-nl/') else c for c in command]
                return real_run(command, **kwargs)
            def inspect(url, model, name, content, **kwargs):
                return {'issues':[{'line':1,'message':'Test finding'}], 'fixed_content':'const value = (;\n' if name == 'invalid.js' else (content.replace('= ;', '= 1;') if name == 'public/valid.js' else content.replace('= 1;', '= 2;'))}
            with patch.object(w, 'run', side_effect=local_run), patch.object(w, 'inspect_content', side_effect=inspect) as mocked:
                report = w.scan_project('DELPHI', args)
                self.assertEqual(report['status'], 'pending')
                self.assertEqual(len(report['fixes']), 1)
                self.assertEqual(report['fixes'][0]['file'], 'public/valid.js')
                self.assertEqual(next(f for f in report['findings'] if f['file']=='invalid.js')['status'], 'rejected')
                self.assertEqual(mocked.call_count, 3)
                hallucination = next(f for f in report['findings'] if f['file']=='correct.js')
                self.assertEqual(hallucination['status'], 'reported')
                self.assertIn('handmatige beoordeling', hallucination['reason'])
                self.assertIn('+const value = 2;', hallucination['proposal'])
                self.assertEqual(real_run(['git', '--git-dir', str(remote), 'rev-parse', 'main']), base)
                self.assertNotEqual(real_run(['git', '--git-dir', str(remote), 'rev-parse', 'DELPHI-fixes']), base)
                self.assertIn('delphi-pwa-v11', real_run(['git','--git-dir',str(remote),'show','DELPHI-fixes:public/sw.js']))
                self.assertEqual(json.loads((data / 'inspections/DELPHI/latest.json').read_text())['head'], report['head'])
                mocked.reset_mock()
                second = w.scan_project('DELPHI', args)
                self.assertEqual(second['head'], report['head'])
                self.assertEqual(second['fixes'], report['fixes'])
                mocked.assert_not_called()

    def test_css_and_html_script_validation(self):
        with self.assertRaises(ValueError): w.balanced_css('a { color: red;')
        w.balanced_css('a { content: "}"; /* { */ color: red; }')
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / 'index.html'
            file.write_text('<html><script>const x = ;</script></html>')
            with self.assertRaises(Exception): w.validate_file(file)
            file.write_text('<html><script>const x = 1;</script></html>')
            w.validate_file(file)

    def test_browser_modules_are_not_false_syntax_bugs(self):
        w.validate_javascript('export const answer = 42;', 'node')
        w.validate_javascript('var await = 42;', 'node')
        with self.assertRaises(Exception):
            w.validate_javascript('export const answer = ;', 'node')

    def test_model_echo_wrong_evidence_and_ambiguous_edits_rejected(self):
        source = 'const value = 1;\nconsole.log(vaule);\n'
        issue = {'line':2,'message':'De verkeerd gespelde variabele veroorzaakt een ReferenceError.','evidence':'console.log(vaule);'}
        valid = {'issues':[issue], 'edits':[{'old':'console.log(vaule);','new':'console.log(value);'}]}
        self.assertEqual(w.validate_inspection(valid, source)['fixed_content'], source.replace('vaule', 'value'))
        for bad in [
            {'issues':[{'line':1,'message':'uitleg','evidence':'const value = 1;'}],'edits':[]},
            {'issues':[{**issue,'evidence':'console.log(missing);'}],'edits':[]},
            {'issues':[{**issue,'line':99}],'edits':[]},
            {'issues':[issue,issue],'edits':[]},
            {'issues':[{**issue,'message':'x'*301}],'edits':[]},
            {'issues':[issue],'edits':[{'old':'console.log(vaule);','new':'x'*501}]},
            {'issues':[issue],'edits':[{'old':'not in source','new':'replacement'}]},
            {'issues':[],'edits':[{'old':'const value = 1;','new':'const value = 2;'}]},
            {'issues':[issue],'edits':[{'old':'const value = 1;','new':'const value = 2;'}]}
        ]:
            with self.assertRaises(ValueError): w.validate_inspection(bad, source)
        self.assertEqual(w.validate_inspection({'issues':[],'edits':[]},source),{'issues':[],'fixed_content':None})


if __name__ == '__main__':
    unittest.main()
